# Interview Explanation

## What Was Built

This is a local-first collaborative document editor using Next.js, React, TypeScript, Tailwind CSS, PostgreSQL-ready API routes, JWT authentication, Joi validation, role-based authorization, offline storage, background synchronization, deterministic conflict resolution, and version history.

## Architecture

- The browser keeps a local copy in IndexedDB, but write actions require sign-in. This gives a good UX while still preventing anonymous users from modifying shared state.
- Every edit becomes an immutable operation with `clientId`, `actorId`, `lamport`, `createdAt`, and payload.
- The sync queue stores pending operations locally. When the browser returns online, the queue posts to `/api/documents/sync`.
- The server validates payloads with Joi, checks JWT auth, confirms the user's document role, rejects viewers for write sync, and persists operations to PostgreSQL.
- Conflict resolution is deterministic because operations are sorted by `lamport`, then `createdAt`, then `clientId`, then `id`.
- Version restore does not mutate history. It appends a `RESTORE_SNAPSHOT` operation, which keeps the shared document timeline auditable.

## UI Flow

- The page opens in read-only preview mode.
- The header has responsive navigation for Editor, Versions, and How it works.
- Sign-in is not shown as a large header form. It opens as a modal only when the user clicks Sign in or tries a protected action.
- Protected actions are editing text, renaming the document, adding/deleting blocks, capturing versions, restoring checkpoints, and AI summary.
- There is no token input in the UI. The JWT is returned by the auth API and stored inside the local workspace state.

## Feature Explanation For Interview

- Local edit: after sign-in, typing creates an operation and writes it to IndexedDB first. That is why the editor feels instant and still works during temporary connection loss.
- Online sync: when online and authenticated, pending operations are sent to `/api/documents/sync`. The server stores them, rebuilds the canonical document, and returns the latest document, operation log, and versions.
- Yellow number badge: this is the count of pending local operations that have not been accepted by the server yet.
- Capture version: saves the current document snapshot with a checkpoint label. It is useful before major edits.
- Block: a document paragraph unit. Block-level operations make conflicts easier to merge deterministically.
- AI summary: an add-on feature that summarizes the current local document text. It is intentionally offline-safe in this version.
- Checkpoint/version history: a list of saved snapshots. Restore creates a new operation instead of deleting the current timeline.

## Security And Reliability Talking Points

- Payload size is limited by `content-length`, Joi max array length, max text size, max snapshot block count, and PostgreSQL JSONB size checks.
- Auth uses bcrypt password hashing and signed JWTs.
- Authorization is enforced in API routes with Owner, Editor, and Viewer roles.
- Tenant isolation is handled with strict SQL scoping by `document_members`, with RLS policies included as defense in depth.
- Duplicate operations are ignored with `on conflict do nothing`, making sync idempotent.
- Offline failures do not lose work because pending operations remain in IndexedDB until a successful sync.

## Why This Solves The Hard Part

The assignment asks for more than CRUD. The hard part is avoiding data loss across offline edits, race conditions, and restore workflows. This project models document changes as an append-only log, which means the system can replay, merge, audit, and compact state safely. The current implementation uses block-level last-writer-wins with deterministic ordering; for production rich text, the same structure can evolve to Yjs/Automerge text CRDT operations.

## How To Run

1. Install dependencies with `npm.cmd install`.
2. Create `.env.local` from `.env.example`.
3. Run the PostgreSQL SQL in `prisma/schema.sql`.
4. Start the app with `npm.cmd run dev`.
5. Open `http://localhost:3000`.

The editor works offline immediately. Authentication and server sync require `DATABASE_URL` and `JWT_SECRET`.

## How To Test With Another User

1. Start PostgreSQL and run `prisma/schema.sql`.
2. Set `DATABASE_URL` and `JWT_SECRET` in `.env.local`.
3. Run `npm.cmd run dev`.
4. Open `http://localhost:3000` in a normal browser window and create/sign in as User A.
5. Open an incognito window or another browser profile and create/sign in as User B.
6. For a full collaboration test, both users must be members of the same document in `document_members`. Insert User B with role `EDITOR` for the same `document_id`, or `VIEWER` to prove viewers cannot sync edits.
7. Edit as User A, then edit as User B. Pending numbers should appear while changes are queued and disappear after sync.

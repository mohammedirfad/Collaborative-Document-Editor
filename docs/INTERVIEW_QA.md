# Interview Questions And Answers

This file explains the main flows in simple interview language, with examples you can speak through.

## 1. Why Is Sign-In Required Before Editing?

The document can be previewed without login, but editing requires authentication because every change must be tied to a real user.

Example:

- Anonymous user opens the page: they can read the sample document.
- Anonymous user tries to type: the sign-in modal opens.
- Signed-in Editor types: the app creates an operation with that user's id.
- Viewer tries to sync changes: the backend rejects the request with `403`.

This is important for collaboration because we need accountability, roles, and audit history.

## 2. How Can We Edit This Document?

Steps:

1. Open `http://localhost:3000`.
2. Click `Sign in` or click inside the editor.
3. Create an account or sign in.
4. After successful login, the editor becomes writable.
5. Type inside a block, add a block, delete a block, rename the document, or capture a version.

In code, protected actions call `requireAuth()` first in `components/EditorShell.tsx`.

Example:

```ts
function updateBlock(block: Block, text: string) {
  if (!requireAuth("Sign in to edit.")) return;
  const next = operation("UPSERT_BLOCK", { blockId: block.id, text });
  if (next) void engine.current?.queue(next);
}
```

So the edit is allowed only after login.

## 3. What Happens When I Type?

Typing does not directly overwrite the whole document on the server. Instead, it creates a small operation.

Example operation:

```json
{
  "kind": "UPSERT_BLOCK",
  "documentId": "demo-document",
  "clientId": "client_123",
  "actorId": "user_456",
  "lamport": 7,
  "payload": {
    "blockId": "intro",
    "text": "Updated document text"
  }
}
```

That operation is:

1. Applied immediately in the browser UI.
2. Saved locally in IndexedDB.
3. Added to the pending sync queue.
4. Sent to the server when online and signed in.

This is why the app feels fast and still works during temporary connection loss.

## 4. How Is The Online Number Calculated?

The yellow number in the status badge is the number of pending local operations.

In `EditorShell.tsx`, it comes from:

```ts
setPending(next.pending.length);
```

The `pending` array lives in the local sync engine state.

Example:

- You type in one block: pending count becomes `1`.
- You add another block: pending count becomes `2`.
- You rename the document: pending count becomes `3`.
- The app syncs successfully: pending count becomes `0`.

So the number does not mean users online. It means unsynced local changes waiting to be pushed to the backend.

## 5. How Does Offline Editing Work?

The browser stores document state in IndexedDB through `lib/localStore.ts`.

When you edit offline:

1. The app creates an operation.
2. The operation updates the visible document immediately.
3. The operation is stored in the local `pending` queue.
4. The yellow badge shows pending operation count.
5. When the network returns, `SyncEngine.flush()` sends the queue to `/api/documents/sync`.

No work is lost if the request fails because pending operations stay in IndexedDB until sync succeeds.

## 6. How Are Conflicts Resolved?

The app uses deterministic operation ordering.

Operations are sorted by:

1. `lamport`
2. `createdAt`
3. `clientId`
4. `id`

This means all clients and the server replay operations in the same order.

Example:

- User A edits block `intro` at Lamport `4`.
- User B edits the same block at Lamport `5`.
- The Lamport `5` operation wins for that block.
- If two operations have the same Lamport value, `createdAt`, `clientId`, and `id` decide the final order.

For the interview, you can say this implementation uses block-level deterministic last-writer-wins. In production rich text, this can be upgraded to Yjs or Automerge while keeping the same operation-log architecture.

## 7. What Is Capture Version?

`Capture version` saves the current document snapshot as a checkpoint.

Example:

- Before making a big change, click `Capture version`.
- The app stores a snapshot with a label like `Checkpoint 12:40 PM`.
- Later, you can click that checkpoint to restore it.

Restore is safe because it creates a new `RESTORE_SNAPSHOT` operation. It does not delete previous history.

## 8. What Is A Block?

A block is one editable document unit, like a paragraph.

Why blocks are useful:

- We do not need to resend the whole document for every small change.
- Conflict resolution is easier because edits are scoped to a block.
- Deleting or updating one block does not directly corrupt other blocks.

Example:

```json
{
  "id": "intro",
  "text": "Start writing here",
  "updatedBy": "user_123"
}
```

## 9. What Is AI Summary?

The AI summary button is an add-on feature. In this version it creates a local summary draft from the current text.

Why it is implemented locally:

- It works without blocking the core editor.
- It demonstrates the AI add-on requirement.
- It can later be connected to OpenAI, Gemini, Groq, or AI SDK.

Production upgrade example:

- Send document text to `/api/ai/summary`.
- Validate text length with Joi.
- Use an AI provider.
- Return a summary.
- Never block editing while AI is running.

## 10. Which Database Is Used?

The assignment mentions PostgreSQL as mandatory, so this project uses PostgreSQL for backend persistence.

The SQL schema is in:

```text
prisma/schema.sql
```

Main tables:

- `users`: stores account profile and password hash.
- `documents`: stores document title and latest snapshot.
- `document_members`: stores role access, like `OWNER`, `EDITOR`, `VIEWER`.
- `document_operations`: stores every sync operation.
- `document_versions`: stores checkpoint snapshots.

## 11. How Are We Saving In The Database?

When the browser syncs, it calls:

```text
POST /api/documents/sync
```

The backend:

1. Reads the JWT token.
2. Validates the request body with Joi.
3. Checks whether the user has access to the document.
4. Rejects the request if the user is a Viewer.
5. Inserts operations into `document_operations`.
6. Rebuilds the latest document snapshot.
7. Updates the `documents.snapshot` JSONB column.

Relevant file:

```text
lib/repository.ts
```

Example insert:

```sql
insert into document_operations
  (id, document_id, actor_id, client_id, kind, lamport, created_at, operation)
values
  ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), $8)
on conflict (id) do nothing;
```

`on conflict do nothing` makes sync idempotent. If the client retries the same operation, the server does not duplicate it.

## 12. How To Check Data In PostgreSQL?

After setting `DATABASE_URL` and running `prisma/schema.sql`, use any PostgreSQL client.

Example with `psql`:

```bash
psql "postgres://postgres:postgres@localhost:5432/house_edtech"
```

Useful queries:

```sql
select id, name, email, created_at from users;
select id, title, owner_id, updated_at from documents;
select document_id, user_id, role from document_members;
select id, document_id, kind, lamport, created_at from document_operations order by created_at desc;
select id, document_id, label, created_at from document_versions order by created_at desc;
```

To see the latest saved document JSON:

```sql
select title, snapshot from documents;
```

To see pending local browser data, open browser DevTools:

1. Application tab.
2. IndexedDB.
3. `house-edtech-editor`.
4. `state`.

That shows the local document, pending operations, operation log, versions, and token.

## 13. How To Test With Another User?

Use two browser sessions:

1. Browser A: create/sign in as User A.
2. Browser B or incognito: create/sign in as User B.
3. Use the Share button from User A to add User B as Editor or Viewer.

The Share button calls:

```text
POST /api/documents/share
```

The backend checks that the current user is the document Owner, finds the invited user by email, and inserts or updates `document_members`.

Example SQL equivalent:

```sql
insert into document_members (document_id, user_id, role)
values ('DOCUMENT_ID_HERE', 'USER_B_ID_HERE', 'EDITOR')
on conflict (document_id, user_id)
do update set role = excluded.role;
```

To test Viewer protection:

```sql
update document_members
set role = 'VIEWER'
where document_id = 'DOCUMENT_ID_HERE'
and user_id = 'USER_B_ID_HERE';
```

User B can still read, but sync writes are rejected by the backend.

The current project includes the share API, share modal, share link, and Documents menu. Users can switch between their own documents and documents shared with them.

## 18. If Jasir Already Wrote His Own Draft, What Happens When Mohd Shares A Document?

Jasir's existing draft and Mohd's shared document are separate documents with separate ids.

Example:

- Jasir's personal draft: `doc_jasir_123`
- Mohd's shared document: `doc_mohd_456`

When Jasir opens Mohd's share link, the app switches the active document to `doc_mohd_456`. It does not merge Mohd's document into Jasir's draft and it does not delete Jasir's draft.

Jasir can use the `Documents` menu to go back to his own document later.

This is the correct behavior because document sharing should grant access to another document, not overwrite someone's personal workspace.

## 19. How Does Jasir Know A Document Was Shared?

In the current project, Mohd clicks `Share`, enters Jasir's registered email, chooses `Editor` or `Viewer`, and the app copies a share link:

```text
http://localhost:3000/?documentId=doc_...
```

Mohd can send that link to Jasir manually through WhatsApp, email, Slack, etc.

Production upgrade:

- Store invite records.
- Send email using Resend, SendGrid, or AWS SES.
- Add an in-app notification/inbox.

The current assignment implementation includes the secure access control and share link flow. Email delivery is an integration layer that can be added later.

## 15. Why Did Two Different Users See The Same Text?

In the earlier demo build, every browser started with the same local document id:

```text
demo-document
```

That meant:

1. Mohd signed in and synced `demo-document`.
2. Irfad signed in from another browser with the same `demo-document` id.
3. The backend saw the same document id and treated both browsers as working on that document.

That was useful for a quick demo, but it was not correct for real authorization because you did not explicitly share the document.

The corrected behavior is:

- Each new browser workspace creates a unique document id like `doc_...`.
- The backend creates membership only when the document is new.
- If a document already exists and another user is not a member, the backend returns access denied.
- To collaborate, you must intentionally add another user in `document_members`.

## 16. Why Did Deleting From Irfad Not Remove It From Mohd Immediately?

There were two reasons:

- Mohd's browser had already loaded its local IndexedDB copy.
- The first sync engine only pushed local pending edits; it did not keep polling for remote updates when there were no local pending edits.

The corrected sync engine now calls sync periodically while signed in and online. So if two users are intentionally members of the same document, remote changes are fetched automatically every few seconds.

In a production real-time app, this polling can be replaced with WebSockets, Server-Sent Events, Yjs provider sync, or a message broker.

## 17. Is This As Per The Assignment?

Yes, this matches the assignment direction:

- Local-first editing: edits apply in the browser first.
- Offline sync queue: unsynced operations stay local until sync succeeds.
- Deterministic merge: operations replay by Lamport time and stable tie-breakers.
- Version history: checkpoints store snapshots and restore through a new operation.
- Auth and roles: write actions require sign-in, and the backend checks document membership.
- Validation/security: sync payloads are Joi-validated and size-limited.

The current implementation is an interview-grade version of the architecture. For production-grade real-time collaboration, the next upgrade would be replacing polling with WebSockets and using Yjs/Automerge for character-level rich-text CRDT merging.

## 14. Why Do We Validate On Frontend And Backend?

Frontend validation improves user experience. It shows fast messages like:

- Name must be at least 2 characters.
- Enter a valid email address.
- Password must be at least 10 characters.

Backend Joi validation is still required for security because attackers can bypass the UI and call the API directly.

So the app uses both:

- Frontend validation in `components/AuthModal.tsx`.
- Backend Joi validation in `lib/schemas.ts`.

# House of Edtech Local-First Editor

Interview assignment implementation for a local-first collaborative document editor with offline synchronization, deterministic conflict resolution, granular version history, validation, authentication, authorization, and PostgreSQL persistence.

## Stack

- Next.js 16 App Router
- React 19 with hooks
- TypeScript
- Tailwind CSS
- PostgreSQL
- Joi validation
- JWT auth with bcrypt password hashing
- IndexedDB local-first storage
- Vitest for sync engine tests

## Run Locally

```bash
npm.cmd install
copy .env.example .env.local
npm.cmd run dev
```

Apply `prisma/schema.sql` to your PostgreSQL database and fill `DATABASE_URL` before testing server sync.

## Assignment Features

- Local-first editing from IndexedDB
- Background sync queue
- Deterministic operation merge
- Offline status and queued edit count
- Version checkpoints and safe restore
- Joi API validation with clear error responses
- JWT authentication
- Sign-in modal for protected write actions
- Owner-only share modal for Editor/Viewer access
- Owner, Editor, Viewer authorization model
- PostgreSQL schema with strict scoping and RLS examples
- AI add-on summary panel

## UX Notes

The editor opens as a read-only preview. When a user tries to type, rename, add blocks, capture a checkpoint, restore a version, or use AI summary, a responsive sign-in modal opens. There is no visible token input; the API returns the JWT after login/register and the app stores it locally. Each new browser workspace gets its own document id, so users are not automatically connected unless you share the document through `document_members`.

The yellow number in the sync badge is the pending operation count. If you edit offline, that number increases. When the app is online and authenticated, the queue syncs to the server and the number returns to zero.

## Testing Multiple Users

Use two browser profiles or one normal window plus one incognito window. Create/sign in with two accounts. To test the same shared document, add the second user to `document_members` for the same `document_id` as `EDITOR` or `VIEWER`. `VIEWER` users can read but the sync API rejects their writes.

Detailed interview answers are in [docs/INTERVIEW_QA.md](docs/INTERVIEW_QA.md).

Database setup and debug steps are in [docs/DATABASE_SETUP.md](docs/DATABASE_SETUP.md).

Git, deployment, and manual test steps are in [docs/DEPLOYMENT_AND_GIT.md](docs/DEPLOYMENT_AND_GIT.md).

Update the footer in [components/EditorShell.tsx](components/EditorShell.tsx) with your real name, GitHub, and LinkedIn before submission.

# House of Edtech Local-First Editor

Full-stack interview assignment: a local-first collaborative document editor with offline synchronization, deterministic conflict handling, granular version history, authentication, authorization, sharing, validation, and PostgreSQL persistence.

## Stack

- Next.js 16 App Router
- React 19 with hooks
- TypeScript
- Tailwind CSS
- PostgreSQL
- Joi validation
- JWT auth with bcrypt password hashing
- IndexedDB local-first storage
- Vitest tests

## Features

- Local-first editing from IndexedDB
- Offline edit queue with background sync
- Deterministic operation ordering with Lamport timestamps
- Version checkpoints and safe restore
- Auth modal for protected actions
- Owner / Editor / Viewer roles
- Share modal with copied document link
- Read-only public preview from shared links
- Documents menu for owned/shared documents
- PostgreSQL operation log and document snapshots
- API payload validation and size limits

## Local Database Setup

Use PostgreSQL. The quickest local setup is Docker.

1. Start PostgreSQL:

```powershell
docker compose up -d
```

2. Create `.env.local` in the project root:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/house_edtech
JWT_SECRET=replace-with-a-long-random-secret
```

3. Run the database schema:

```powershell
Get-Content prisma/schema.sql | docker exec -i house-edtech-postgres psql -U postgres -d house_edtech
```

4. Verify tables:

```powershell
npm.cmd run db:check
```

Expected result:

```text
Tables OK
users: 0
documents: 0
document_members: 0
document_operations: 0
document_versions: 0
```

If an older partial schema run failed, repair it:

```powershell
Get-Content prisma/repair-partial-schema.sql | docker exec -i house-edtech-postgres psql -U postgres -d house_edtech
npm.cmd run db:check
```

## Run Locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Useful Database Queries

Registered users:

```sql
select id, name, email, created_at
from users
order by created_at desc;
```

Documents:

```sql
select id, title, owner_id, updated_at
from documents
order by updated_at desc;
```

Roles:

```sql
select document_id, user_id, role
from document_members;
```

Saved edit operations:

```sql
select id, document_id, actor_id, kind, lamport, created_at
from document_operations
order by created_at desc
limit 20;
```

Latest document snapshot:

```sql
select title, snapshot
from documents
order by updated_at desc
limit 1;
```

## Manual Test: Offline Sync

1. Sign in.
2. Type online text.
3. Wait until the yellow pending number is `0`.
4. Open Chrome DevTools.
5. Go to Network.
6. Set throttling to Offline.
7. Type new text in the editor.
8. Confirm the text appears immediately.
9. Confirm the yellow pending number increases.
10. Set Network back to No throttling.
11. Wait until status becomes Online and pending returns to `0`.
12. Check `document_operations` in PostgreSQL to confirm the offline edit synced.

## Manual Test: Sharing

1. Browser A: sign in as User A.
2. Create or edit a document.
3. Click Share.
4. Enter User B's registered email.
5. Choose Editor or Viewer.
6. Click Share access.
7. Copy the visible share link.
8. Browser B or incognito: open the share link.
9. Before login, the document opens as read-only preview.
10. Sign in as User B.
11. If User B is Editor, typing is enabled.
12. If User B is Viewer, typing stays blocked.

Important: if you paste the share link in User A's already signed-in browser, it will show User A as Owner. Use another browser/incognito to test User B permissions.

## GitHub Push

Do not commit `.env.local`.

```powershell
git init
git add .
git commit -m "Build local-first collaborative editor"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

If Git asks for identity:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

## Neon Production Database

1. Create a Neon project.
2. Open Neon SQL Editor.
3. Copy all SQL from `prisma/schema.sql`.
4. Paste and run it.
5. Confirm the statement executed successfully.
6. Verify tables:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected tables:

```text
document_members
document_operations
document_versions
documents
users
```

Use the Neon connection string as `DATABASE_URL`. Prefer:

```text
sslmode=verify-full
```

## Vercel Deployment

1. Push the project to GitHub.
2. Open Vercel.
3. Add New Project.
4. Import the GitHub repository.
5. Framework should be Next.js.
6. Add environment variables:

```text
DATABASE_URL=your-neon-postgres-url
JWT_SECRET=your-long-random-secret
```

7. Do not use `NEXT_PUBLIC_` for these variables.
8. Deploy.

After deployment:

1. Open the Vercel URL.
2. Register a user.
3. Edit a document.
4. Share with another registered user.
5. Test the share link in incognito.

If you change environment variables in Vercel, redeploy the project.

## Interview Notes

The browser stores local state first, then syncs operations in the background. Edits become immutable operations, stored locally while offline and pushed to the server when online. The backend validates payloads with Joi, checks JWT auth and document role, persists operations in PostgreSQL, rebuilds the document snapshot, and returns canonical state.

Update the footer in `components/EditorShell.tsx` with your real name, GitHub profile, and LinkedIn profile before final submission.

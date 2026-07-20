# Git, Deployment, And Manual Testing Guide

## 1. Push To GitHub

Run these commands from the project root:

```powershell
git init
git add .
git commit -m "Build local-first collaborative editor"
```

Create an empty GitHub repository from github.com. Do not add a README there because this project already has one.

Then connect and push:

```powershell
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

If Git asks who you are:

```powershell
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Before pushing, check what will go:

```powershell
git status
```

Do not commit `.env.local`. It contains secrets. This project should commit `.env.example`, not `.env.local`.

## 2. Best Hosting Choice

Recommended setup:

- **Vercel** for the Next.js app.
- **Neon** or **Supabase Postgres** for hosted PostgreSQL.

This is better than Render for this project because Vercel is designed for Next.js App Router deployments. Render can work, but Vercel is smoother for interviews.

## 3. Deploy PostgreSQL

Option A - Neon:

1. Go to `https://neon.tech`.
2. Create a new project.
3. Copy the pooled PostgreSQL connection string.
4. It will look like:

```text
postgresql://user:password@host/dbname?sslmode=require
```

Option B - Supabase:

1. Go to `https://supabase.com`.
2. Create a new project.
3. Open Project Settings -> Database.
4. Copy the connection string.

## 4. Run Schema On Hosted DB

Use pgAdmin, DBeaver, Neon SQL Editor, Supabase SQL Editor, or `psql`.

Run all SQL from:

```text
prisma/schema.sql
```

Then verify tables exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

You should see:

- `users`
- `documents`
- `document_members`
- `document_operations`
- `document_versions`

## 5. Deploy To Vercel

1. Push code to GitHub.
2. Go to `https://vercel.com`.
3. Click `Add New` -> `Project`.
4. Import your GitHub repository.
5. Add environment variables:

```text
DATABASE_URL=your-hosted-postgres-url
JWT_SECRET=make-this-a-long-random-secret
```

6. Framework should auto-detect as Next.js.
7. Click Deploy.

After deploy, open the live URL and create an account.

## 6. Deploy To Render Alternative

Use Render only if you specifically want all services there.

1. Push code to GitHub.
2. Go to `https://render.com`.
3. Create a PostgreSQL database.
4. Copy the internal/external database URL.
5. Create a Web Service from your GitHub repository.
6. Use:

```text
Build Command: npm install && npm run build
Start Command: npm run start
```

7. Add environment variables:

```text
DATABASE_URL=your-render-postgres-url
JWT_SECRET=make-this-a-long-random-secret
```

8. Run `prisma/schema.sql` against the Render PostgreSQL database.

## 7. Manual Test With Two Browsers

Use two browser sessions:

- Browser A: normal Chrome window.
- Browser B: Incognito window or another browser like Edge.

Important: clear old site data first if you tested the previous demo document.

Chrome:

1. Open DevTools.
2. Go to Application.
3. Go to Storage.
4. Click Clear site data.

Now test:

1. Open the app in Browser A.
2. Create account `mohd@example.com`.
3. Type in the document.
4. Wait until the yellow pending number becomes `0`.
5. Open the app in Browser B.
6. Create account `irfad@example.com`.
7. Browser B should have its own document, not Mohd's document.
8. In Browser A, click `Share`.
9. Enter `irfad@example.com`.
10. Select `Editor`.
11. Click `Share access`.
12. The app copies a share link like `http://localhost:3000/?documentId=doc_...`.
13. Send/paste that link into Browser B.
14. Browser B opens the shared document after sign-in.
15. Browser B can edit if shared as `Editor`.
16. Browser B is read-only if shared as `Viewer`.
17. Use the `Documents` menu to switch between Browser B's own draft and Mohd's shared document.

If Browser B already wrote something before opening Mohd's shared document, that work is preserved as Browser B's own document. Opening a shared document switches the active document; it does not merge or overwrite unrelated personal drafts.

## 8. How A Normal User Would Use It

Current app flow:

1. User opens the app.
2. User signs in.
3. User edits their local-first document.
4. User clicks `Share`.
5. User enters another registered user's email.
6. User chooses `Editor` or `Viewer`.

What is included:

- Auth.
- Local-first editor.
- Sync.
- Role-based backend protection.
- Share API.
- Share modal.
- Documents menu for owned/shared documents.
- Shareable link using `?documentId=...`.

What is not included yet:

- Email delivery to the invited user.

For the interview, say: "The app supports access sharing and share links. Email delivery is a production integration that can be added with Resend, SendGrid, or AWS SES."

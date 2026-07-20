# Database Setup And Debug Guide

Use PostgreSQL for this project. The easiest tools are:

- **pgAdmin 4**: best GUI for beginners. You can see tables, rows, and run SQL.
- **DBeaver**: good GUI if you already use database tools.
- **psql**: terminal tool, fastest for interview/demo commands.

Recommended for your case: use **pgAdmin 4** to inspect data visually, and use `npm.cmd run db:check` from the project to confirm the app can connect.

## 1. Create `.env.local`

Create this file in the project root:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/house_edtech
JWT_SECRET=replace-with-a-long-random-secret
```

Change username/password/database name if your PostgreSQL setup is different.

## 2. Create The Database

Option A - Docker:

```bash
docker compose up -d
```

This starts PostgreSQL with:

```text
DATABASE_URL=postgres://postgres:postgres@localhost:5432/house_edtech
```

Option B - pgAdmin:

In pgAdmin:

1. Open pgAdmin.
2. Right-click `Databases`.
3. Click `Create` then `Database`.
4. Name it `house_edtech`.

Option C - `psql`:

With `psql`:

```bash
createdb house_edtech
```

## 3. Run The Schema

In pgAdmin:

1. Select the `house_edtech` database.
2. Open Query Tool.
3. Open/copy `prisma/schema.sql`.
4. Run it.

With `psql`:

```bash
psql "postgres://postgres:postgres@localhost:5432/house_edtech" -f prisma/schema.sql
```

With Docker:

```powershell
Get-Content prisma/schema.sql | docker exec -i house-edtech-postgres psql -U postgres -d house_edtech
```

If an older partial schema run failed before creating `document_operations`, run:

```powershell
Get-Content prisma/repair-partial-schema.sql | docker exec -i house-edtech-postgres psql -U postgres -d house_edtech
```

Then verify:

```powershell
npm.cmd run db:check
```

## 4. Check The Connection

Run:

```bash
npm.cmd run db:check
```

Expected output:

```text
Connected: PostgreSQL ...
Tables OK
users: 0
documents: 0
document_members: 0
document_operations: 0
document_versions: 0
```

If this fails, registration will fail too.

## 5. Check Registered Users

In pgAdmin Query Tool:

```sql
select id, name, email, created_at
from users
order by created_at desc;
```

If your email is here, login instead of creating the account again.

## 6. Check Documents

```sql
select id, title, owner_id, updated_at
from documents
order by updated_at desc;
```

## 7. Check Roles

```sql
select document_id, user_id, role
from document_members;
```

Roles are:

- `OWNER`: can manage and edit.
- `EDITOR`: can edit and sync.
- `VIEWER`: can read but cannot push sync updates.

## 8. Check Saved Operations

```sql
select id, document_id, actor_id, kind, lamport, created_at
from document_operations
order by created_at desc;
```

Every edit creates one operation. The yellow number in the UI is the local count before these operations are accepted by the server.

## 9. Check Version History

```sql
select id, document_id, label, created_at
from document_versions
order by created_at desc;
```

## 10. Why Registration Was Showing Wrong Error

Before the fix, the register API caught every database error and returned:

```json
{"error":"Unable to create account. Email may already be registered."}
```

That message appeared even when the real problem was:

- `DATABASE_URL` missing.
- PostgreSQL server not running.
- Database does not exist.
- Tables were not created.
- Wrong database password.

Now the API returns a more accurate message, such as:

```json
{"error":"Database tables are missing. Run prisma/schema.sql in PostgreSQL, then try again."}
```

or:

```json
{"error":"Cannot connect to PostgreSQL. Start the database server and check DATABASE_URL."}
```

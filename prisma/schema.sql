create extension if not exists pgcrypto;

do $$
begin
  create type document_role as enum ('OWNER', 'EDITOR', 'VIEWER');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type operation_kind as enum ('UPSERT_BLOCK', 'DELETE_BLOCK', 'SET_TITLE', 'RESTORE_SNAPSHOT');
exception
  when duplicate_object then null;
end $$;

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name varchar(80) not null,
  email varchar(160) not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id text primary key default gen_random_uuid()::text,
  title varchar(120) not null,
  owner_id text not null references users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_members (
  document_id text not null references documents(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role document_role not null,
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create table if not exists document_operations (
  id varchar(100) primary key,
  document_id text not null references documents(id) on delete cascade,
  actor_id text not null references users(id) on delete cascade,
  client_id varchar(120) not null,
  kind operation_kind not null,
  lamport integer not null check (lamport > 0 and lamport <= 1000000),
  created_at timestamptz not null,
  operation jsonb not null,
  constraint operation_size check (pg_column_size(operation) <= 100000)
);

create index if not exists document_operations_order_idx
  on document_operations (document_id, lamport, created_at, id);

create table if not exists document_versions (
  id text primary key default gen_random_uuid()::text,
  document_id text not null references documents(id) on delete cascade,
  label varchar(80) not null,
  created_by text not null references users(id) on delete cascade,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint version_snapshot_size check (pg_column_size(snapshot) <= 500000)
);

alter table users enable row level security;
alter table documents enable row level security;
alter table document_members enable row level security;
alter table document_operations enable row level security;
alter table document_versions enable row level security;

-- App queries still use strict joins by user id. These RLS policies are a second line of defense
-- for hosted PostgreSQL platforms that support setting app.current_user_id per request.
drop policy if exists document_member_read on documents;
create policy document_member_read on documents
  for select using (
    exists (
      select 1 from document_members
      where document_members.document_id = documents.id
      and document_members.user_id = current_setting('app.current_user_id', true)
    )
  );

drop policy if exists operation_member_read on document_operations;
create policy operation_member_read on document_operations
  for select using (
    exists (
      select 1 from document_members
      where document_members.document_id = document_operations.document_id
      and document_members.user_id = current_setting('app.current_user_id', true)
    )
  );

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

alter table document_operations enable row level security;

drop policy if exists operation_member_read on document_operations;
create policy operation_member_read on document_operations
  for select using (
    exists (
      select 1 from document_members
      where document_members.document_id = document_operations.document_id
      and document_members.user_id = current_setting('app.current_user_id', true)
    )
  );

import { getPool } from "@/lib/db";
import { applyOperations, compactOperations, createBlankDocument } from "@/lib/crdt";
import type { DocumentSnapshot, Role, SyncOperation, Version } from "@/types/document";

export async function createUser(name: string, email: string, passwordHash: string) {
  const { rows } = await getPool().query(
    `insert into users (name, email, password_hash)
     values ($1, lower($2), $3)
     returning id, name, email`,
    [name, email, passwordHash]
  );
  return rows[0] as { id: string; name: string; email: string };
}

export async function findUserByEmail(email: string) {
  const { rows } = await getPool().query(
    `select id, name, email, password_hash as "passwordHash"
     from users
     where email = lower($1)`,
    [email]
  );
  return rows[0] as { id: string; name: string; email: string; passwordHash: string } | undefined;
}

export async function getMemberRole(documentId: string, userId: string): Promise<Role | null> {
  const { rows } = await getPool().query(
    `select role
     from document_members
     where document_id = $1 and user_id = $2`,
    [documentId, userId]
  );
  return (rows[0]?.role as Role | undefined) ?? null;
}

export async function ensureDocumentOwnedByUser(document: DocumentSnapshot, userId: string) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const inserted = await client.query(
      `insert into documents (id, title, snapshot, owner_id)
       values ($1, $2, $3, $4)
       on conflict (id) do nothing
       returning id`,
      [document.id, document.title, document, userId]
    );
    if (inserted.rowCount === 1) {
      await client.query(
        `insert into document_members (document_id, user_id, role)
         values ($1, $2, 'OWNER')
         on conflict (document_id, user_id) do nothing`,
        [document.id, userId]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function loadDocument(documentId: string, userId: string) {
  const role = await getMemberRole(documentId, userId);
  if (!role) return null;

  const [documentResult, operationResult, versionResult] = await Promise.all([
    getPool().query(`select id, title, snapshot from documents where id = $1`, [documentId]),
    getPool().query(`select operation from document_operations where document_id = $1 order by lamport, created_at, id`, [
      documentId
    ]),
    getPool().query(`select id, document_id as "documentId", label, created_at as "createdAt", created_by as "createdBy", snapshot from document_versions where document_id = $1 order by created_at desc`, [
      documentId
    ])
  ]);

  const stored = documentResult.rows[0]?.snapshot as DocumentSnapshot | undefined;
  const operations = operationResult.rows.map((row) => row.operation as SyncOperation);
  const document = applyOperations(stored ?? createBlankDocument(documentId), operations);
  return { document, operations, versions: versionResult.rows as Version[], role };
}

export async function loadPublicDocument(documentId: string) {
  const [documentResult, operationResult, versionResult] = await Promise.all([
    getPool().query(`select id, title, snapshot from documents where id = $1`, [documentId]),
    getPool().query(`select operation from document_operations where document_id = $1 order by lamport, created_at, id`, [
      documentId
    ]),
    getPool().query(`select id, document_id as "documentId", label, created_at as "createdAt", created_by as "createdBy", snapshot from document_versions where document_id = $1 order by created_at desc`, [
      documentId
    ])
  ]);

  const stored = documentResult.rows[0]?.snapshot as DocumentSnapshot | undefined;
  if (!stored) return null;

  const operations = operationResult.rows.map((row) => row.operation as SyncOperation);
  const document = applyOperations(stored, operations);
  return { document, operations, versions: versionResult.rows as Version[] };
}

export async function persistOperations(documentId: string, operations: SyncOperation[]) {
  const unique = compactOperations(operations);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    for (const operation of unique) {
      await client.query(
        `insert into document_operations (id, document_id, actor_id, client_id, kind, lamport, created_at, operation)
         values ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), $8)
         on conflict (id) do nothing`,
        [
          operation.id,
          documentId,
          operation.actorId,
          operation.clientId,
          operation.kind,
          operation.lamport,
          operation.createdAt,
          operation
        ]
      );
    }

    const { rows } = await client.query(
      `select snapshot from documents where id = $1 for update`,
      [documentId]
    );
    const current = (rows[0]?.snapshot as DocumentSnapshot | undefined) ?? createBlankDocument(documentId);
    const next = applyOperations(current, unique);
    await client.query(
      `update documents set title = $2, snapshot = $3, updated_at = now() where id = $1`,
      [documentId, next.title, next]
    );
    await client.query("commit");
    return next;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveVersion(documentId: string, userId: string, label: string, snapshot: DocumentSnapshot) {
  const { rows } = await getPool().query(
    `insert into document_versions (document_id, label, created_by, snapshot)
     values ($1, $2, $3, $4)
     returning id, document_id as "documentId", label, created_at as "createdAt", created_by as "createdBy", snapshot`,
    [documentId, label, userId, snapshot]
  );
  return rows[0] as Version;
}

export async function shareDocumentWithUser(documentId: string, ownerId: string, targetEmail: string, role: Extract<Role, "EDITOR" | "VIEWER">) {
  const ownerRole = await getMemberRole(documentId, ownerId);
  if (ownerRole !== "OWNER") {
    return { ok: false as const, status: 403, message: "Only the document owner can share access." };
  }

  const target = await findUserByEmail(targetEmail);
  if (!target) {
    return { ok: false as const, status: 404, message: "No registered user found for that email. Ask them to create an account first." };
  }

  await getPool().query(
    `insert into document_members (document_id, user_id, role)
     values ($1, $2, $3)
     on conflict (document_id, user_id)
     do update set role = excluded.role`,
    [documentId, target.id, role]
  );

  return {
    ok: true as const,
    member: {
      id: target.id,
      name: target.name,
      email: target.email,
      role
    }
  };
}

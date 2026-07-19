import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { createBlankDocument } from "@/lib/crdt";
import { readSession } from "@/lib/security";

export async function GET(request: Request) {
  const user = await readSession(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { rows } = await getPool().query(
    `select d.id, d.title, d.updated_at as "updatedAt", m.role
     from documents d
     join document_members m on m.document_id = d.id
     where m.user_id = $1
     order by d.updated_at desc`,
    [user.id]
  );

  return NextResponse.json({ documents: rows });
}

export async function POST(request: Request) {
  const user = await readSession(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const document = createBlankDocument();
  document.title = "Untitled collaborative document";
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const { rows } = await client.query(
      `insert into documents (title, snapshot, owner_id)
       values ($1, $2, $3)
       returning id, title, updated_at as "updatedAt"`,
      [document.title, document, user.id]
    );
    await client.query(
      `insert into document_members (document_id, user_id, role)
       values ($1, $2, 'OWNER')`,
      [rows[0].id, user.id]
    );
    await client.query("commit");
    return NextResponse.json({ document: rows[0] }, { status: 201 });
  } catch (error) {
    await client.query("rollback");
    return NextResponse.json({ error: "Unable to create document." }, { status: 500 });
  } finally {
    client.release();
  }
}

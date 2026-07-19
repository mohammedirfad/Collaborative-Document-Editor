import { NextResponse } from "next/server";
import { loadDocument, saveVersion } from "@/lib/repository";
import { AuthzError, assertCanWrite, readSession } from "@/lib/security";
import { validateBody, ValidationError, versionSchema } from "@/lib/schemas";
import type { DocumentSnapshot } from "@/types/document";

export async function POST(request: Request) {
  const user = await readSession(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = validateBody<{ documentId: string; label: string; snapshot: DocumentSnapshot }>(
      versionSchema,
      await request.json()
    );
    const loaded = await loadDocument(body.documentId, user.id);
    if (!loaded) return NextResponse.json({ error: "Document not found or access denied." }, { status: 404 });
    assertCanWrite(loaded.role);
    return NextResponse.json({ version: await saveVersion(body.documentId, user.id, body.label, body.snapshot) }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid version payload", details: error.details }, { status: 422 });
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to save version." }, { status: 500 });
  }
}

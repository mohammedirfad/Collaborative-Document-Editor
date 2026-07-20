import { NextResponse } from "next/server";
import { applyOperations, createBlankDocument } from "@/lib/crdt";
import { ensureDocumentOwnedByUser, loadDocument, persistOperations } from "@/lib/repository";
import { AuthzError, assertCanWrite, readSession } from "@/lib/security";
import { syncSchema, validateBody, ValidationError } from "@/lib/schemas";
import type { SyncRequest } from "@/types/document";

export async function POST(request: Request) {
  const user = await readSession(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1_000_000) {
      return NextResponse.json({ error: "Payload is too large for a single sync batch." }, { status: 413 });
    }

    const body = validateBody<SyncRequest>(syncSchema, await request.json());
    let loaded = await loadDocument(body.documentId, user.id);
    if (!loaded && (body.operations.length > 0 || body.clientSnapshot)) {
      const initialBase = body.clientSnapshot ?? createBlankDocument(body.documentId);
      const initial = applyOperations(initialBase, body.operations);
      await ensureDocumentOwnedByUser(initial, user.id);
      loaded = await loadDocument(body.documentId, user.id);
    }
    if (!loaded) return NextResponse.json({ error: "Document not found or access denied." }, { status: 404 });

    if (body.operations.length > 0) {
      assertCanWrite(loaded.role);
    }
    const safeOperations = body.operations.map((operation) => ({ ...operation, actorId: user.id }));
    const document = safeOperations.length > 0 ? await persistOperations(body.documentId, safeOperations) : loaded.document;
    const fresh = await loadDocument(body.documentId, user.id);

    return NextResponse.json({
      document,
      operations: fresh?.operations ?? [],
      versions: fresh?.versions ?? [],
      role: fresh?.role
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid synchronization payload", details: error.details }, { status: 422 });
    }
    if (error instanceof AuthzError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Synchronization failed. Local changes remain queued." }, { status: 500 });
  }
}

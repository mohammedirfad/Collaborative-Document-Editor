import { NextResponse } from "next/server";
import { loadPublicDocument } from "@/lib/repository";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required." }, { status: 400 });
  }

  const loaded = await loadPublicDocument(documentId);
  if (!loaded) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  return NextResponse.json({
    document: loaded.document,
    operations: loaded.operations,
    versions: loaded.versions,
    role: "VIEWER"
  });
}

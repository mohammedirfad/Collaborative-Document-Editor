import { NextResponse } from "next/server";
import { shareDocumentWithUser } from "@/lib/repository";
import { readSession } from "@/lib/security";
import { shareSchema, validateBody, ValidationError } from "@/lib/schemas";
import type { Role } from "@/types/document";

export async function POST(request: Request) {
  const user = await readSession(request.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = validateBody<{ documentId: string; email: string; role: Extract<Role, "EDITOR" | "VIEWER"> }>(
      shareSchema,
      await request.json()
    );
    const result = await shareDocumentWithUser(body.documentId, user.id, body.email, body.role);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json({ member: result.member });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid share request", details: error.details }, { status: 422 });
    }
    return NextResponse.json({ error: "Unable to share document." }, { status: 500 });
  }
}

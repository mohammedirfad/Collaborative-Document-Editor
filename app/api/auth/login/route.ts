import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/repository";
import { signSession, verifyPassword } from "@/lib/security";
import { loginSchema, validateBody, ValidationError } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = validateBody<{ email: string; password: string }>(loginSchema, await request.json());
    const user = await findUserByEmail(body.email);
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    const safeUser = { id: user.id, name: user.name, email: user.email };
    return NextResponse.json({ user: safeUser, token: await signSession(safeUser) });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid login data", details: error.details }, { status: 422 });
    }
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}

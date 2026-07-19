import { NextResponse } from "next/server";
import { createUser } from "@/lib/repository";
import { hashPassword, signSession } from "@/lib/security";
import { registerSchema, validateBody, ValidationError } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const body = validateBody<{ name: string; email: string; password: string }>(registerSchema, await request.json());
    const user = await createUser(body.name, body.email, await hashPassword(body.password));
    const token = await signSession(user);
    return NextResponse.json({ user, token }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: "Invalid registration data", details: error.details }, { status: 422 });
    }

    const dbError = getDatabaseErrorResponse(error);
    return NextResponse.json({ error: dbError.message }, { status: dbError.status });
  }
}

function getDatabaseErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "DATABASE_URL is not configured") {
    return {
      status: 503,
      message: "Database is not configured. Create .env.local and set DATABASE_URL before registering."
    };
  }

  if (isPostgresError(error)) {
    if (error.code === "23505") {
      return {
        status: 409,
        message: "This email is already registered. Please sign in instead."
      };
    }
    if (error.code === "42P01") {
      return {
        status: 503,
        message: "Database tables are missing. Run prisma/schema.sql in PostgreSQL, then try again."
      };
    }
    if (error.code === "28P01") {
      return {
        status: 503,
        message: "Database login failed. Check the username and password in DATABASE_URL."
      };
    }
    if (error.code === "3D000") {
      return {
        status: 503,
        message: "Database does not exist. Create the database from DATABASE_URL, then run prisma/schema.sql."
      };
    }
  }

  if (error instanceof Error && /ECONNREFUSED|getaddrinfo|timeout/i.test(error.message)) {
    return {
      status: 503,
      message: "Cannot connect to PostgreSQL. Start the database server and check DATABASE_URL."
    };
  }

  return {
    status: 500,
    message: "Unable to create account because the database returned an unexpected error. Check the server terminal."
  };
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string";
}

import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/types/document";

const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "change-this-secret-before-deployment");

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(user: SessionUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function readSession(authHeader: string | null): Promise<SessionUser | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name)
    };
  } catch {
    return null;
  }
}

export function assertCanWrite(role: Role) {
  if (role === "VIEWER") {
    throw new AuthzError("Viewers can read documents but cannot push synchronization updates.");
  }
}

export class AuthzError extends Error {}

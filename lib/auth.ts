import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload, SessionUser } from "./types";

// The secret must be at least 32 chars. In production, set a strong JWT_SECRET env var.
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "fallback-dev-secret-please-set-jwt-secret-env-var"
);

const COOKIE_NAME = "at_session";
const EXPIRES_IN = "8h"; // token lifespan

/** Sign a new JWT containing the user's session data. */
export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(secret);
}

/** Verify a JWT and return the decoded payload, or null if invalid/expired. */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };

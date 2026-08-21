// ─── Shared TypeScript types for the session / JWT payload ───────────────────

export type UserRole = "ADMIN" | "AGENT";

/** The data we encode inside the JWT and expose to the frontend. */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Shape of the cookie payload after jwtVerify. */
export interface JWTPayload extends SessionUser {
  iat: number; // issued-at (seconds)
  exp: number; // expires-at (seconds)
}

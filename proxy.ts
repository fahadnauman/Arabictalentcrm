import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

// Routes that don't require a valid session
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Next.js 16 uses `proxy` as the export name (was `middleware` in older versions)
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Allow public routes through without checking ────────────────────────
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // ── Get the session cookie ──────────────────────────────────────────────
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // ── Verify the JWT ──────────────────────────────────────────────────────
  const payload = await verifyToken(token);

  if (!payload) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // ── Inject user info into request headers for server components ─────────
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.id);
  requestHeaders.set("x-user-email", payload.email);
  requestHeaders.set("x-user-name", payload.name);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

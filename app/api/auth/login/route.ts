import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    // ── 1. Parse and validate request body ─────────────────────────────────
    const body = await request.json().catch(() => null);

    if (!body || !body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const email = String(body.email).toLowerCase().trim();
    const password = String(body.password);

    // ── 2. Look up user in the database ────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        passwordHash: true,
        role: true,
        isActive: true,
      },
    });

    // Return the same generic error for "not found" and "wrong password"
    // so attackers can't enumerate valid emails.
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ── 3. Verify password ──────────────────────────────────────────────────
    const passwordValid = user.passwordHash 
      ? await bcrypt.compare(password, user.passwordHash)
      : user.password === password;
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ── 4. Sign JWT ─────────────────────────────────────────────────────────
    const token = await signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as "ADMIN" | "AGENT",
    });

    // ── 5. Return success + set HttpOnly session cookie ─────────────────────
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,                                    // JS cannot read this cookie
      secure: process.env.NODE_ENV === "production",    // HTTPS only in prod
      sameSite: "lax",
      maxAge: 60 * 60 * 8,                             // 8 hours in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[/api/auth/login] Unexpected error:", error);
    return NextResponse.json(
      { error: "An internal server error occurred. Please try again." },
      { status: 500 }
    );
  }
}

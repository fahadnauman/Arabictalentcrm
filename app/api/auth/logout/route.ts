import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url, 303);
}

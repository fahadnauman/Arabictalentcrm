import { NextRequest, NextResponse } from "next/server";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { markChatAsRead } from "@/app/actions/message";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const { leadId } = await params;

  // 1. Verify Authentication
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // 2. Execute Mark as Read Sync
  const result = await markChatAsRead(leadId);
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Failed to mark as read" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

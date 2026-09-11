import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(
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

  // 2. Fetch Lead & Messages
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      assignedAgentId: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id: true,
          body: true,
          direction: true,
          sentAt: true,
          isStatusReply: true,
          mediaUrl: true,
          mediaType: true,
          sentBy: { select: { name: true } },
        },
      },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
    return NextResponse.json({ error: "Forbidden: Not your lead" }, { status: 403 });
  }

  // 3. Transform to ChatMessage shape with media fallback URLs
  const messages = lead.messages.map((m) => {
    const hasMedia = !!(
      m.mediaUrl ||
      (m.mediaType &&
        (m.mediaType.includes("image") ||
          m.mediaType.includes("audio") ||
          m.mediaType.includes("video") ||
          m.mediaType.includes("document") ||
          m.mediaType.includes("ogg") ||
          m.mediaType.includes("opus") ||
          m.mediaType.includes("webm") ||
          m.mediaType.includes("wav") ||
          m.mediaType.includes("mp4") ||
          m.mediaType.includes("pdf")))
    );

    return {
      id: m.id,
      body: m.body,
      direction: m.direction,
      sentAt: m.sentAt.toISOString(),
      senderName: m.sentBy?.name ?? null,
      mediaUrl: m.mediaUrl || (hasMedia ? `/api/media/${m.id}` : null),
      mediaType: m.mediaType,
      isStatusReply: m.isStatusReply,
    };
  });

  return NextResponse.json(messages, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}

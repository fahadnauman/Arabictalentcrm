import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;

  try {
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { rawPayload: true, mediaType: true }
    });

    if (!msg || !msg.rawPayload) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const payload = msg.rawPayload as { type?: string; base64?: string };

    if (payload.type !== "attachment" || !payload.base64) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Convert base64 Data URI to Buffer
    // Format: "data:image/png;base64,iVBORw0KGgo..."
    const base64Data = payload.base64.split(",")[1];
    if (!base64Data) {
      return new NextResponse("Invalid Base64 format", { status: 400 });
    }

    const buffer = Buffer.from(base64Data, "base64");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": msg.mediaType || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    console.error("Error serving media:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

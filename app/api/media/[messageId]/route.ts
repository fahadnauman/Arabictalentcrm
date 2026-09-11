import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EVO_URL = process.env.EVO_API_URL || "http://143.198.182.24:8080";
const EVO_KEY = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "arabic-talent-prod";

function normalizeMime(mediaType?: string | null): string {
  if (!mediaType) return "application/octet-stream";
  const lower = mediaType.toLowerCase();
  if (lower === "imagemessage" || lower.includes("image/")) return lower === "imagemessage" ? "image/jpeg" : mediaType;
  if (lower.includes("audio/webm") || lower.includes("webm")) return "audio/webm";
  if (lower.includes("audio/mp4") || lower.includes("m4a")) return "audio/mp4";
  if (lower.includes("audio/wav") || lower.includes("wav")) return "audio/wav";
  if (lower === "audiomessage" || lower.includes("audio/ogg") || lower.includes("ogg") || lower.includes("opus")) {
    return "audio/ogg; codecs=opus";
  }
  if (lower.includes("audio/")) return mediaType;
  if (lower === "videomessage" || lower.includes("video/")) return "video/mp4";
  if (lower === "documentmessage" || lower.includes("pdf")) return "application/pdf";
  return mediaType;
}

export async function GET(req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;

  try {
    const msg = await prisma.message.findFirst({
      where: {
        OR: [
          { id: messageId },
          { twilioSid: messageId }
        ]
      },
      select: { id: true, rawPayload: true, mediaType: true, twilioSid: true }
    });

    if (!msg) {
      return new NextResponse("Not Found", { status: 404 });
    }

    let base64String: string | null = null;
    const payload = (msg.rawPayload as any) || {};

    if (typeof payload.base64 === "string" && payload.base64.length > 0) {
      base64String = payload.base64;
    } else if (typeof payload === "string" && payload.startsWith("data:")) {
      base64String = payload;
    }

    // If base64 is not cached, attempt to fetch directly from Evolution API
    if (!base64String && (msg.twilioSid || payload.message)) {
      try {
        const evoRes = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVO_KEY
          },
          body: JSON.stringify({
            message: payload.message || { key: { id: msg.twilioSid } },
            convertToMp4: false
          })
        });

        if (evoRes.ok) {
          const data = await evoRes.json();
          if (data.base64) {
            base64String = data.base64;
            // Cache back to database asynchronously for future requests
            prisma.message.update({
              where: { id: msg.id },
              data: {
                rawPayload: {
                  type: "attachment",
                  base64: data.base64,
                  message: payload.message || null
                }
              }
            }).catch(() => {});
          }
        }
      } catch (evoErr) {
        console.warn("Could not fetch media from Evolution API:", evoErr);
      }
    }

    if (!base64String) {
      return new NextResponse("Media Not Found", { status: 404 });
    }

    // Parse base64
    const cleanBase64 = base64String.includes(",") ? base64String.split(",")[1] : base64String;
    const buffer = Buffer.from(cleanBase64, "base64");

    const contentType = normalizeMime(msg.mediaType);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes"
      }
    });
  } catch (error) {
    console.error("Error serving media:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

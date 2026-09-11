import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EVO_URL = process.env.EVO_API_URL || "http://143.198.182.24:8080";
const EVO_KEY = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "arabic-talent-prod";

/**
 * Inspects buffer binary signatures (magic bytes) to guarantee the HTTP response
 * Content-Type matches the exact container format of the audio stream.
 */
function detectMimeType(buffer: Buffer, fallbackMime?: string | null): string {
  if (buffer.length >= 4) {
    // 1. OGG container: 'OggS' -> 0x4F 0x67 0x67 0x53 (WhatsApp default voice note)
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
      return "audio/ogg; codecs=opus";
    }

    // 2. WebM / Matroska: 0x1A 0x45 0xDF 0xA3 (Chrome / Edge recording)
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
      if (fallbackMime && (fallbackMime.includes("video") || fallbackMime.includes("videomessage"))) {
        return "video/webm";
      }
      return "audio/webm; codecs=opus";
    }

    // 3. MP4 / M4A: 'ftyp' at byte offset 4
    if (buffer.length >= 8 && buffer.toString("ascii", 4, 8) === "ftyp") {
      if (fallbackMime && (fallbackMime.includes("audio") || fallbackMime.includes("m4a"))) {
        return "audio/mp4";
      }
      return "video/mp4";
    }

    // 4. MP3: ID3 header or MPEG sync frame
    if (
      (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
      (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)
    ) {
      return "audio/mpeg";
    }

    // 5. WAV: 'RIFF' ... 'WAVE'
    if (
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WAVE"
    ) {
      return "audio/wav";
    }

    // 6. AAC: ADTS sync word
    if (buffer[0] === 0xFF && (buffer[1] === 0xF1 || buffer[1] === 0xF9)) {
      return "audio/aac";
    }

    // 7. Visual Media / Documents
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "image/png";
    if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "application/pdf";
  }

  // Fallback to normalized database/metadata MIME
  if (fallbackMime) {
    const lower = fallbackMime.toLowerCase();
    if (lower.includes("video") || lower === "videomessage") return "video/mp4";
    if (lower.includes("webm")) return "audio/webm; codecs=opus";
    if (lower.includes("ogg") || lower.includes("opus") || lower === "audiomessage") return "audio/ogg; codecs=opus";
    if (lower.includes("mp4") || lower.includes("m4a")) return "audio/mp4";
    if (lower.includes("mpeg") || lower.includes("mp3")) return "audio/mpeg";
    if (lower.includes("image")) return "image/jpeg";
    if (lower.includes("pdf")) return "application/pdf";
    return fallbackMime;
  }

  return "application/octet-stream";
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
    let payload = msg.rawPayload as any;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        if (payload.startsWith("data:") || payload.length > 50) {
          base64String = payload;
        }
      }
    }

    if (payload && typeof payload === "object") {
      if (typeof payload.base64 === "string" && payload.base64.length > 0) {
        base64String = payload.base64;
      } else if (typeof payload.data === "string" && payload.data.length > 0) {
        base64String = payload.data;
      }
    }

    // If base64 is not cached, attempt to fetch directly from Evolution API
    if (!base64String && (msg.twilioSid || (payload && payload.message))) {
      try {
        const evoRes = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVO_KEY
          },
          body: JSON.stringify({
            message: payload?.message || { key: { id: msg.twilioSid } },
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
                  message: payload?.message || null
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

    // Parse base64 into binary buffer
    const cleanBase64 = base64String.includes(",") ? base64String.split(",")[1] : base64String;
    const buffer = Buffer.from(cleanBase64.trim().replace(/[\r\n\s]/g, ""), "base64");

    if (!buffer || buffer.length === 0) {
      return new NextResponse("Invalid Media Content", { status: 404 });
    }

    const totalSize = buffer.length;
    const contentType = detectMimeType(buffer, msg.mediaType);

    // Support HTTP Range requests (RFC 7233) for seamless audio/video streaming & metadata decoding
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : totalSize - 1;

        if (start < totalSize && end < totalSize && start <= end) {
          const chunk = buffer.subarray(start, end + 1);
          return new NextResponse(chunk, {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Content-Range": `bytes ${start}-${end}/${totalSize}`,
              "Accept-Ranges": "bytes",
              "Content-Length": chunk.length.toString(),
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }

      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${totalSize}`,
        },
      });
    }

    // Standard 200 response with full Content-Length and Range declaration
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": totalSize.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving media:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

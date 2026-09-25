import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { markChatAsRead } from "@/app/actions/message";

const EVO_URL = process.env.EVO_API_URL || "http://143.198.182.24:8080";
const EVO_KEY = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "arabic-talent-prod";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const leadId = formData.get("leadId") as string | null;
    const caption = (formData.get("caption") as string | null) || "";

    if (!leadId) {
      return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Row-level guard: Fetch lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, phone: true, assignedAgentId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
      return NextResponse.json({ error: "Access denied: Not your lead" }, { status: 403 });
    }

    // 1. Read binary data into buffer safely and ensure ArrayBuffer to Base64 is fully intact
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "Empty file uploaded" }, { status: 400 });
    }

    // 2. Extract and determine MIME type from FormData file object
    const declaredMime = (file.type || "").split(";")[0].trim().toLowerCase();
    const originalName = file.name || "attachment";
    const lowerName = originalName.toLowerCase();

    // 1. Isolate the Audio Fix (Protect Video/Documents)
    // Wrap .ogg renaming strictly in audio check
    const isAudio =
      declaredMime.startsWith("audio/") ||
      lowerName.endsWith(".ogg") ||
      lowerName.endsWith(".opus") ||
      lowerName.endsWith(".mp3") ||
      lowerName.endsWith(".wav") ||
      lowerName.startsWith("voice_note.");

    let fileName: string = originalName;
    let targetMime: string = declaredMime || "application/octet-stream";
    let computedMediatype: "audio" | "video" | "image" | "document" = "document";

    if (isAudio) {
      computedMediatype = "audio";
      targetMime = "audio/ogg";
      const isVoice =
        originalName === "Voice Note" ||
        originalName.startsWith("voice_note.") ||
        declaredMime.includes("ogg") ||
        declaredMime.includes("webm") ||
        declaredMime.includes("opus");
      fileName = isVoice ? "voice_note.ogg" : originalName;
    } else {
      // If the file is a video, image, or document, pass the original MIME type and original file extension directly without modification
      fileName = originalName;
      targetMime = declaredMime || "application/octet-stream";

      if (
        declaredMime.startsWith("video/") ||
        lowerName.endsWith(".mp4") ||
        lowerName.endsWith(".mov") ||
        lowerName.endsWith(".webm") ||
        lowerName.endsWith(".mkv") ||
        lowerName.endsWith(".3gp") ||
        lowerName.endsWith(".avi")
      ) {
        computedMediatype = "video";
      } else if (
        declaredMime.startsWith("image/") ||
        lowerName.endsWith(".jpg") ||
        lowerName.endsWith(".jpeg") ||
        lowerName.endsWith(".png") ||
        lowerName.endsWith(".webp") ||
        lowerName.endsWith(".gif")
      ) {
        computedMediatype = "image";
      } else {
        computedMediatype = "document";
      }
    }

    const isVisualMedia = computedMediatype === "image" || computedMediatype === "video";

    // Persist to DB with verified targetMime (clean empty body for visual media unless user typed a caption)
    let msg = await prisma.message.create({
      data: {
        leadId,
        body: caption.trim() || (isVisualMedia ? "" : fileName),
        direction: "OUTBOUND",
        status: "SENT",
        sentById: user.id,
        mediaType: targetMime,
        rawPayload: { type: "attachment", base64: base64Data },
      },
      select: {
        id: true,
        body: true,
        direction: true,
        sentAt: true,
        sentBy: { select: { name: true } },
        mediaUrl: true,
        mediaType: true,
      },
    });

    const mediaUrl = `/api/media/${msg.id}`;
    msg = await prisma.message.update({
      where: { id: msg.id },
      data: { mediaUrl },
      select: {
        id: true,
        body: true,
        direction: true,
        sentAt: true,
        sentBy: { select: { name: true } },
        mediaUrl: true,
        mediaType: true,
      },
    });

    const toPhone = lead.phone.replace(/\D/g, "");

    // Trigger 2: Instantly sync mark as read right before sending outbound reply
    await markChatAsRead(leadId).catch((err) => console.warn("Auto markChatAsRead error in upload:", err));

    try {
      if (isAudio) {
        // Anti-Ban Human Simulation: Fire presence: "recording" before dispatching voice note
        try {
          await fetch(`${EVO_URL}/chat/sendPresence/${EVO_INSTANCE}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: EVO_KEY,
            },
            body: JSON.stringify({
              number: `${toPhone}@s.whatsapp.net`,
              presence: "recording",
              delay: 5000,
            }),
          });
        } catch (presenceErr) {
          console.warn("Evolution API sendPresence recording failed in upload:", presenceErr);
        }

        // WhatsApp Audio / Voice Note (PTT)
        // Strip data:audio/...;base64, prefix if present, and send raw base64 string
        let rawBase64 = base64Data.trim();
        if (rawBase64.includes(";base64,")) {
          rawBase64 = rawBase64.split(";base64,")[1];
        } else if (rawBase64.startsWith("data:")) {
          rawBase64 = rawBase64.substring(rawBase64.indexOf(",") + 1);
        }
        rawBase64 = rawBase64.replace(/[\r\n\s]/g, "");

        const res = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify({
            number: toPhone,
            audio: rawBase64,
            mimetype: "audio/ogg",
            ptt: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Evolution API sendWhatsAppAudio Error: HTTP ${res.status} - ${errText}`);
          await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
          return NextResponse.json(
            { error: `Evolution API Audio Error: HTTP ${res.status}`, rawResponse: errText },
            { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
          );
        }

        const evoData = await res.json().catch(() => null);
        const exactId =
          evoData?.key?.id ||
          evoData?.message?.key?.id ||
          evoData?.response?.key?.id ||
          evoData?.response?.message?.key?.id ||
          evoData?.data?.key?.id ||
          evoData?.data?.message?.key?.id ||
          evoData?.data?.id ||
          evoData?.id ||
          evoData?.messageId;

        if (exactId && typeof exactId === "string") {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: exactId.trim() },
          }).catch((err) => console.error("Failed to update message twilioSid:", err));
        }
      } else {
        // Send Video / Image / Document via sendMedia with raw base64, original MIME type, and original file extension
        let rawBase64 = base64Data.trim();
        if (rawBase64.includes(";base64,")) {
          rawBase64 = rawBase64.split(";base64,")[1];
        } else if (rawBase64.startsWith("data:")) {
          rawBase64 = rawBase64.substring(rawBase64.indexOf(",") + 1);
        }
        rawBase64 = rawBase64.replace(/[\r\n\s]/g, "");

        const isVisualMedia = computedMediatype === "image" || computedMediatype === "video";

        // For images and videos: completely remove fileName property from JSON payload
        // Only pass number, mediatype, and media (base64) so it renders as a clean, captionless image bubble in WhatsApp
        const sendMediaPayload: Record<string, any> = isVisualMedia
          ? {
              number: toPhone,
              mediatype: computedMediatype,
              media: rawBase64,
              ...(caption.trim() ? { caption: caption.trim() } : {}),
            }
          : {
              number: toPhone,
              options: {
                delay: 0,
                presence: "composing",
              },
              mediatype: computedMediatype,
              mimetype: targetMime,
              caption: caption.trim() || "",
              media: rawBase64,
              fileName: originalName,
            };

        const res = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify(sendMediaPayload),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Evolution API sendMedia Error: HTTP ${res.status} - ${errText}`);
          await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
          return NextResponse.json(
            { error: `Evolution API Media Error: HTTP ${res.status}`, rawResponse: errText },
            { status: res.status >= 400 && res.status < 600 ? res.status : 500 }
          );
        }

        const evoData = await res.json().catch(() => null);
        const exactId =
          evoData?.key?.id ||
          evoData?.message?.key?.id ||
          evoData?.response?.key?.id ||
          evoData?.response?.message?.key?.id ||
          evoData?.data?.key?.id ||
          evoData?.data?.message?.key?.id ||
          evoData?.data?.id ||
          evoData?.id ||
          evoData?.messageId;

        if (exactId && typeof exactId === "string") {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: exactId.trim() },
          }).catch((err) => console.error("Failed to update message twilioSid:", err));
        }
      }
    } catch (evoErr: any) {
      console.error("Evolution API transmission exception:", evoErr);
      await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
      return NextResponse.json(
        { error: "Failed to transmit media to WhatsApp API", rawResponse: String(evoErr?.message || evoErr) },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: {
        id: msg.id,
        body: msg.body,
        direction: msg.direction,
        sentAt: msg.sentAt.toISOString(),
        senderName: msg.sentBy?.name ?? null,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
      },
    });
  } catch (err: any) {
    console.error("Upload Route Handler Error:", err);
    return NextResponse.json(
      { error: "Internal Server Error", rawResponse: String(err?.message || err) },
      { status: 500 }
    );
  }
}

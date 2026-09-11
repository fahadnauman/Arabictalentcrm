import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

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

    // 2. Extract and strictly determine the correct MIME type from FormData file object
    let rawMime = (file.type || "").split(";")[0].trim().toLowerCase();
    const originalName = file.name || "attachment";
    const lowerName = originalName.toLowerCase();

    // If file.type was omitted or generic octet-stream, infer from extension
    if (!rawMime || rawMime === "application/octet-stream") {
      if (lowerName.endsWith(".mp4") || lowerName.endsWith(".m4v")) rawMime = "video/mp4";
      else if (lowerName.endsWith(".mov")) rawMime = "video/quicktime";
      else if (lowerName.endsWith(".webm")) rawMime = "video/webm";
      else if (lowerName.endsWith(".3gp")) rawMime = "video/3gpp";
      else if (lowerName.endsWith(".avi")) rawMime = "video/x-msvideo";
      else if (lowerName.endsWith(".mkv")) rawMime = "video/x-matroska";
      else if (lowerName.endsWith(".png")) rawMime = "image/png";
      else if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) rawMime = "image/jpeg";
      else if (lowerName.endsWith(".webp")) rawMime = "image/webp";
      else if (lowerName.endsWith(".pdf")) rawMime = "application/pdf";
      else if (lowerName.endsWith(".ogg") || lowerName.endsWith(".opus")) rawMime = "audio/ogg";
      else if (lowerName.endsWith(".mp3")) rawMime = "audio/mpeg";
      else if (lowerName.endsWith(".wav")) rawMime = "audio/wav";
      else if (lowerName.endsWith(".m4a")) rawMime = "audio/mp4";
    }

    // 3. Classify media category strictly (Video takes precedence over generic audio/webm)
    const isVideo =
      rawMime.startsWith("video/") ||
      lowerName.endsWith(".mp4") ||
      lowerName.endsWith(".m4v") ||
      lowerName.endsWith(".mov") ||
      lowerName.endsWith(".webm") ||
      lowerName.endsWith(".3gp") ||
      lowerName.endsWith(".mkv");

    const isAudio =
      !isVideo &&
      (rawMime.startsWith("audio/") ||
       rawMime === "audio/ogg" ||
       rawMime === "audio/webm" ||
       rawMime.includes("opus") ||
       lowerName.endsWith(".ogg") ||
       lowerName.endsWith(".mp3") ||
       lowerName.endsWith(".wav") ||
       lowerName.endsWith(".m4a") ||
       lowerName.startsWith("voice_note."));

    const isImage = !isVideo && !isAudio && rawMime.startsWith("image/");

    // 4. For WhatsApp video compatibility, strictly normalize video mimetype to "video/mp4"
    // WhatsApp/Baileys requires strict "video/mp4" to avoid "something is wrong with the video file"
    const targetMime = isVideo
      ? "video/mp4"
      : isAudio
      ? (rawMime || "audio/ogg")
      : (rawMime || "application/octet-stream");

    const computedMediatype = isVideo ? "video" : isImage ? "image" : isAudio ? "audio" : "document";

    // 5. Ensure fileName strictly has .mp4 for video so Evolution API's lookup sets video/mp4
    let fileName: string;
    if (isVideo) {
      const base = originalName.replace(/\.[^/.]+$/, "");
      fileName = `${base || "video"}.mp4`;
    } else if (isAudio) {
      let ext = "ogg";
      if (rawMime.includes("webm")) ext = "webm";
      else if (rawMime.includes("mp4") || rawMime.includes("m4a")) ext = "m4a";
      else if (rawMime.includes("wav")) ext = "wav";
      else if (rawMime.includes("mp3") || rawMime.includes("mpeg")) ext = "mp3";

      const isVoice = originalName === "Voice Note" || originalName.startsWith("voice_note.");
      fileName = isVoice ? `voice_note.${ext}` : (originalName.includes(".") ? originalName : `${originalName}.${ext}`);
    } else {
      fileName = originalName;
    }

    // Persist to DB with verified targetMime
    let msg = await prisma.message.create({
      data: {
        leadId,
        body: caption.trim() || fileName,
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

    try {
      if (isAudio) {
        // WhatsApp Audio / Voice Note (PTT)
        const cleanBase64 = base64Data.trim().replace(/[\r\n\s]/g, "");
        const res = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify({
            number: toPhone,
            audio: cleanBase64,
            delay: 1200,
            encoding: true,
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
        if (evoData?.key?.id) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: evoData.key.id },
          }).catch(() => {});
        }
      } else {
        // Send Video / Image / Document via sendMedia
        const res = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify({
            number: toPhone,
            options: {
              delay: 0,
              presence: "composing",
            },
            mediatype: computedMediatype,
            mimetype: targetMime,
            caption: caption.trim() || "",
            media: base64Data,
            fileName: fileName,
          }),
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
        if (evoData?.key?.id) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: evoData.key.id },
          }).catch(() => {});
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

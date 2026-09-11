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

    // Read binary data into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "application/octet-stream";
    const originalName = file.name || "attachment";

    const isImage = mimeType.includes("image");
    const isVideo = mimeType.includes("video");
    const isAudio =
      mimeType.includes("audio") ||
      mimeType.includes("ogg") ||
      mimeType.includes("opus") ||
      mimeType.includes("webm");
    const computedMediatype = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document";

    // Derive safe extension
    let ext = "bin";
    if (mimeType === "application/pdf") ext = "pdf";
    else if (isImage) ext = mimeType.split("/")[1]?.split(";")[0] || "png";
    else if (isVideo) ext = mimeType.split("/")[1]?.split(";")[0] || "mp4";
    else if (isAudio) {
      if (mimeType.includes("webm")) ext = "webm";
      else if (mimeType.includes("mp4") || mimeType.includes("m4a")) ext = "m4a";
      else if (mimeType.includes("ogg") || mimeType.includes("opus")) ext = "ogg";
      else if (mimeType.includes("wav")) ext = "wav";
      else ext = mimeType.split("/")[1]?.split(";")[0] || "mp3";
    } else if (mimeType.includes("spreadsheet")) ext = "xlsx";
    else if (mimeType.includes("word")) ext = "docx";

    const isVoiceNote = isAudio && (originalName === "Voice Note" || originalName.startsWith("voice_note."));
    const fileName = isVoiceNote
      ? (originalName.includes(".") ? originalName : `voice_note.${ext}`)
      : (originalName || `attachment_${Date.now()}.${ext}`);

    // Persist to DB
    let msg = await prisma.message.create({
      data: {
        leadId,
        body: caption.trim() || fileName,
        direction: "OUTBOUND",
        status: "SENT",
        sentById: user.id,
        mediaType: mimeType,
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
            mimetype: mimeType,
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

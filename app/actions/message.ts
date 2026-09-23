"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

const EVO_URL = process.env.EVO_API_URL || "http://143.198.182.24:8080";
const EVO_KEY = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "arabic-talent-prod";

export interface SentMessage {
  id:        string;
  body:      string;
  direction: "INBOUND" | "OUTBOUND";
  sentAt:    string;
  senderName: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  status?:   string | null;
}

export type SendMessageResult =
  | { success: true; data: SentMessage }
  | { success: false; status: number; error: string; rawResponse?: string };

/** Saves an outbound message to the database and sends it via Evolution API. */
export async function sendMessage(
  leadId: string,
  body:   string,
  mediaBase64?: string,
  mediaType?: string
): Promise<SendMessageResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return { success: false, status: 401, error: "Unauthorised", rawResponse: "Missing authentication cookie" };
  }

  const user = await verifyToken(token);
  if (!user) {
    return { success: false, status: 401, error: "Unauthorised", rawResponse: "Invalid JWT token" };
  }

  // Row-level guard: Fetch lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, phone: true, assignedAgentId: true }
  });

  if (!lead) {
    return { success: false, status: 404, error: "Lead not found", rawResponse: `No lead found for id: ${leadId}` };
  }

  if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
    return { success: false, status: 403, error: "Access denied: Not your lead", rawResponse: "Forbidden: Lead assigned to another agent" };
  }

  // We generate a temp ID for the URL if needed, but since we create it first, we'll update it after if we have media.
  let payload: any = null;
  if (mediaBase64) {
    payload = { type: "attachment", base64: mediaBase64 };
  }

  // Persist to DB
  let msg = await prisma.message.create({
    data: {
      leadId,
      body:      body.trim(),
      direction: "OUTBOUND",
      status:    "SENT",
      sentById:  user.id,
      mediaType: mediaType || null,
      rawPayload: payload
    },
    select: {
      id:        true,
      body:      true,
      direction: true,
      sentAt:    true,
      sentBy:    { select: { name: true } },
      mediaUrl:  true,
      mediaType: true,
    },
  });

  // If there's media, construct relative proxy URL
  if (mediaBase64) {
    const mediaUrl = `/api/media/${msg.id}`;
    
    msg = await prisma.message.update({
      where: { id: msg.id },
      data: { mediaUrl },
      select: {
        id: true, body: true, direction: true, sentAt: true, sentBy: { select: { name: true } }, mediaUrl: true, mediaType: true
      }
    });
  }

  // Clean phone for WhatsApp integration (strip everything except digits)
  const toPhone = lead.phone.replace(/\D/g, "");

  try {
    if (mediaBase64) {
      // Send Media
      const parts = mediaBase64.split(",");
      const base64Data = parts.length > 1 ? parts[1] : parts[0];
      let mType = mediaType || "application/octet-stream";
      if (parts.length > 1 && parts[0].includes("data:")) {
        mType = parts[0].split(";")[0].split(":")[1];
      }

      const isImage = mType.includes("image");
      const isVideo = mType.includes("video");
      const isAudio = mType.includes("audio") || mType.includes("ogg") || mType.includes("opus") || mType.includes("webm");
      const computedMediatype = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "document";
      
      // Derive a safe file extension matching native MIME
      let ext = "bin";
      if (mType === "application/pdf") ext = "pdf";
      else if (isImage) ext = mType.split("/")[1]?.split(";")[0] || "png";
      else if (isVideo) ext = mType.split("/")[1]?.split(";")[0] || "mp4";
      else if (isAudio) {
        if (mType.includes("webm")) ext = "webm";
        else if (mType.includes("mp4") || mType.includes("m4a")) ext = "m4a";
        else if (mType.includes("ogg") || mType.includes("opus")) ext = "ogg";
        else if (mType.includes("wav")) ext = "wav";
        else ext = mType.split("/")[1]?.split(";")[0] || "mp3";
      }
      else if (mType.includes("spreadsheet")) ext = "xlsx";
      else if (mType.includes("word")) ext = "docx";

      const isVoiceNote = isAudio && (body.trim() === "Voice Note" || body.trim().startsWith("voice_note."));
      const fileName = isVoiceNote
        ? (body.trim().includes(".") ? body.trim() : `voice_note.${ext}`)
        : `attachment_${Date.now()}.${ext}`;

      if (isAudio) {
        // WhatsApp Audio / Voice Note (PTT)
        // Clean and buffer the audio payload into a pure Base64 string
        const cleanBase64 = base64Data.trim().replace(/[\r\n\s]/g, "");
        const audioBuffer = Buffer.from(cleanBase64, "base64");
        const formattedBase64 = audioBuffer.toString("base64");

        // Send via Evolution API's sendWhatsAppAudio endpoint with encoding: true
        // This triggers Evolution API's ffmpeg to transcode into WhatsApp's native PTT Opus format (audio/ogg; codecs=opus)
        const res = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVO_KEY
          },
          body: JSON.stringify({
            number: toPhone,
            audio: formattedBase64,
            delay: 1200,
            encoding: true
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Evolution API sendWhatsAppAudio Error: ${res.status} ${errText}`);
          await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
          return {
            success: false,
            status: res.status,
            error: `Evolution API Audio Error: HTTP ${res.status}`,
            rawResponse: errText,
          };
        }

        const evoData = await res.json().catch(() => null);
        if (evoData?.key?.id) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: evoData.key.id }
          }).catch(() => {});
        }
      } else {
        const res = await fetch(`${EVO_URL}/message/sendMedia/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVO_KEY
          },
          body: JSON.stringify({
            number: toPhone,
            options: {
              delay: 0,
              presence: "composing"
            },
            mediatype: computedMediatype,
            mimetype: mType,
            caption: body.trim() || "",
            media: base64Data,
            fileName: fileName
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Evolution API sendMedia Error: ${res.status} ${errText}`);
          await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
          return {
            success: false,
            status: res.status,
            error: `Evolution API Media Error: HTTP ${res.status}`,
            rawResponse: errText,
          };
        }

        const evoData = await res.json().catch(() => null);
        if (evoData?.key?.id) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: evoData.key.id }
          }).catch(() => {});
        }
      }
    } else {
      // Send Text
      const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVO_KEY
        },
        body: JSON.stringify({
          number: toPhone,
          options: {
            delay: 0,
            presence: "composing"
          },
          text: body.trim()
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`Evolution API sendText Error: ${res.status} ${errText}`);
        await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
        return {
          success: false,
          status: res.status,
          error: `Evolution API Text Error: HTTP ${res.status}`,
          rawResponse: errText,
        };
      }

      const evoData = await res.json().catch(() => null);
      if (evoData?.key?.id) {
        await prisma.message.update({
          where: { id: msg.id },
          data: { twilioSid: evoData.key.id }
        }).catch(() => {});
      }
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to send message via Evolution API:", errorMessage);
    
    // Update DB status to FAILED
    if (msg?.id) {
      await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } }).catch(() => {});
    }
    return {
      success: false,
      status: 500,
      error: `Evolution Error: ${errorMessage}`,
      rawResponse: err instanceof Error ? (err.stack || err.message) : String(err),
    };
  }

  return {
    success: true,
    data: {
      id:         msg.id,
      body:       msg.body,
      direction:  msg.direction,
      sentAt:     msg.sentAt.toISOString(),
      senderName: msg.sentBy?.name ?? null,
      mediaUrl:   msg.mediaUrl,
      mediaType:  msg.mediaType,
      status:     "SENT",
    },
  };
}

/**
 * Records an outbound media message in the database that was already transmitted
 * directly from the browser to the DigitalOcean VPS Evolution API endpoint.
 * Safely parses metadata, wraps DB writes in try/catch, and guarantees a graceful success.
 */
export async function recordOutboundMedia(
  leadId: string,
  fileName: string,
  mimeType: string,
  evoMetadata?: any
): Promise<SendMessageResult> {
  const sanitizedFileName = String(fileName || "attachment").trim();
  const sanitizedMimeType = String(mimeType || "application/octet-stream").trim();

  // Safely parse Evolution API response/metadata if passed as string or object
  let parsedEvo: any = evoMetadata;
  if (typeof parsedEvo === "string") {
    try {
      parsedEvo = JSON.parse(parsedEvo);
    } catch {
      parsedEvo = null;
    }
  }

  // Extract only lightweight identifiers (e.g. key.id / twilioSid)
  const keyId: string | null =
    (typeof parsedEvo?.key?.id === "string" && parsedEvo.key.id.trim())
      ? parsedEvo.key.id.trim()
      : (typeof parsedEvo?.keyId === "string" && parsedEvo.keyId.trim())
      ? parsedEvo.keyId.trim()
      : (typeof parsedEvo?.id === "string" && parsedEvo.id.trim())
      ? parsedEvo.id.trim()
      : null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      return { success: false, status: 401, error: "Unauthorised", rawResponse: "Missing authentication cookie" };
    }

    const user = await verifyToken(token);
    if (!user) {
      return { success: false, status: 401, error: "Unauthorised", rawResponse: "Invalid JWT token" };
    }

    // Row-level guard: Fetch lead
    let lead: { id: string; assignedAgentId: string | null } | null = null;
    try {
      lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, assignedAgentId: true },
      });
    } catch (leadErr) {
      console.warn("Error looking up lead in recordOutboundMedia:", leadErr);
    }

    if (!lead) {
      return { success: false, status: 404, error: "Lead not found", rawResponse: `No lead found for id: ${leadId}` };
    }

    if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
      return { success: false, status: 403, error: "Access denied: Not your lead", rawResponse: "Forbidden: Lead assigned to another agent" };
    }

    // Prepare strictly lightweight and JSON-safe metadata (< 500 bytes)
    const safePayload = {
      type: "direct_upload",
      fileName: sanitizedFileName,
      mimeType: sanitizedMimeType,
      keyId: keyId,
      timestamp: Date.now(),
    };

    let msg: any = null;

    // Database insertion wrapped in robust try/catch
    try {
      // Check if message with this twilioSid was already recorded (e.g. by webhook)
      if (keyId) {
        const existing = await prisma.message.findUnique({
          where: { twilioSid: keyId },
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
        if (existing) {
          return {
            success: true,
            data: {
              id: existing.id,
              body: existing.body,
              direction: existing.direction,
              sentAt: existing.sentAt.toISOString(),
              senderName: existing.sentBy?.name ?? user.name,
              mediaUrl: existing.mediaUrl,
              mediaType: existing.mediaType,
              status: "SENT",
            },
          };
        }
      }

      msg = await prisma.message.create({
        data: {
          leadId,
          body: sanitizedFileName,
          direction: "OUTBOUND",
          status: "SENT",
          sentById: user.id,
          mediaType: sanitizedMimeType,
          twilioSid: keyId,
          rawPayload: safePayload,
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
    } catch (dbErr: any) {
      console.error("Database write error in recordOutboundMedia:", dbErr);
      // Fallback: If unique constraint on twilioSid failed, try creating without twilioSid
      if (keyId && (dbErr?.code === "P2002" || String(dbErr).includes("Unique constraint"))) {
        try {
          msg = await prisma.message.create({
            data: {
              leadId,
              body: sanitizedFileName,
              direction: "OUTBOUND",
              status: "SENT",
              sentById: user.id,
              mediaType: sanitizedMimeType,
              twilioSid: null,
              rawPayload: safePayload,
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
        } catch (fallbackErr) {
          console.error("Fallback message creation failed:", fallbackErr);
        }
      }
    }

    // Graceful success response even if Postgres insertion encountered an issue
    return {
      success: true,
      data: {
        id: msg?.id || `vps-${keyId || Date.now()}`,
        body: msg?.body || sanitizedFileName,
        direction: msg?.direction || "OUTBOUND",
        sentAt: msg?.sentAt ? msg.sentAt.toISOString() : new Date().toISOString(),
        senderName: msg?.sentBy?.name ?? user.name,
        mediaUrl: msg?.mediaUrl || null,
        mediaType: msg?.mediaType || sanitizedMimeType,
        status: "SENT",
      },
    };
  } catch (err: any) {
    console.error("Unexpected error in recordOutboundMedia:", err);
    // Never return an HTTP 500 error after WhatsApp delivery has already succeeded
    return {
      success: true,
      data: {
        id: `vps-${keyId || Date.now()}`,
        body: sanitizedFileName,
        direction: "OUTBOUND",
        sentAt: new Date().toISOString(),
        senderName: null,
        mediaUrl: null,
        mediaType: sanitizedMimeType,
        status: "SENT",
      },
    };
  }
}


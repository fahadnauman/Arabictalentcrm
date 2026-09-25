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

function extractWhatsAppMessageId(data: any): string | null {
  if (!data) return null;
  const target = Array.isArray(data) ? data[0] : data;
  if (!target) return null;

  const candidate =
    target.key?.id ||
    target.message?.key?.id ||
    target.response?.key?.id ||
    target.response?.message?.key?.id ||
    target.data?.key?.id ||
    target.data?.message?.key?.id ||
    target.data?.id ||
    target.id ||
    target.messageId;

  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
}

/**
 * Synchronizes read state with Evolution API and marks inbound messages as read in the database.
 * Condition 1: When an agent clicks a lead's card in the Inbox to open the chat window.
 * Condition 2: Instantly right before an agent sends an outbound reply from the CRM.
 */
export async function markChatAsRead(leadId: string): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, phone: true },
    });

    if (!lead || !lead.phone) {
      return { success: false, error: "Lead or phone not found" };
    }

    const cleanPhone = lead.phone.replace(/\D/g, "");
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;

    // Find any unread inbound messages for this lead
    const unreadMsgs = await prisma.message.findMany({
      where: {
        leadId: lead.id,
        direction: "INBOUND",
        status: { notIn: ["READ", "PLAYED"] },
      },
      select: { id: true, twilioSid: true },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    // Also find latest inbound message if none are marked unread
    const latestInbound = await prisma.message.findFirst({
      where: { leadId: lead.id, direction: "INBOUND" },
      select: { id: true, twilioSid: true },
      orderBy: { sentAt: "desc" },
    });

    // 1. Update all unread inbound messages in CRM database to READ
    if (unreadMsgs.length > 0) {
      await prisma.message.updateMany({
        where: { id: { in: unreadMsgs.map((m) => m.id) } },
        data: {
          status: "READ",
          readAt: new Date(),
        },
      });
    }

    // 2. Build readMessages payload for Evolution API
    const readMessages = unreadMsgs
      .filter((m) => m.twilioSid)
      .map((m) => ({
        remoteJid,
        fromMe: false,
        id: m.twilioSid!,
      }));

    if (readMessages.length === 0 && latestInbound?.twilioSid) {
      readMessages.push({
        remoteJid,
        fromMe: false,
        id: latestInbound.twilioSid,
      });
    }

    // 3. Fire Evolution API /chat/markAsRead/{instance} to sync physical phone host device
    try {
      const markRes = await fetch(`${EVO_URL}/chat/markAsRead/${EVO_INSTANCE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVO_KEY,
        },
        body: JSON.stringify({
          number: cleanPhone,
          remoteJid,
          readMessages,
        }),
      });

      // If markAsRead endpoint returns 404 on Baileys/v2, fall back to /chat/markMessageAsRead
      if (markRes.status === 404) {
        await fetch(`${EVO_URL}/chat/markMessageAsRead/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify({
            readMessages:
              readMessages.length > 0
                ? readMessages
                : [{ remoteJid, fromMe: false, id: latestInbound?.twilioSid || "true" }],
          }),
        }).catch((err) => console.warn("Evolution API markMessageAsRead fallback error:", err));
      }
      console.log(`[Read Sync] Marked chat as read for ${cleanPhone} (messages synced: ${readMessages.length})`);
    } catch (evoErr) {
      console.warn("[Read Sync] Evolution API markAsRead error:", evoErr);
    }

    return { success: true, count: unreadMsgs.length };
  } catch (err: any) {
    console.error("markChatAsRead exception:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

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

  // Trigger 2: Instantly sync mark as read right before sending an outbound reply
  await markChatAsRead(leadId).catch((err) => console.warn("Auto markChatAsRead error in sendMessage:", err));

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

      const isVoiceNote = isAudio && (
        body.trim() === "Voice Note" ||
        body.trim().startsWith("voice_note.") ||
        mType.includes("ogg") ||
        mType.includes("webm") ||
        mType.includes("opus")
      );
      const fileName = isVoiceNote
        ? "voice_note.ogg"
        : `attachment_${Date.now()}.${ext}`;

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
          console.warn("Evolution API sendPresence recording failed:", presenceErr);
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

        // Send via Evolution API's sendWhatsAppAudio endpoint strictly as audio/ogg PTT
        const res = await fetch(`${EVO_URL}/message/sendWhatsAppAudio/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": EVO_KEY
          },
          body: JSON.stringify({
            number: toPhone,
            audio: rawBase64,
            mimetype: "audio/ogg",
            ptt: true,
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
        const exactId = extractWhatsAppMessageId(evoData);
        if (exactId) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: exactId }
          }).catch((err) => console.error("Failed to update message twilioSid:", err));
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
        const exactId = extractWhatsAppMessageId(evoData);
        if (exactId) {
          await prisma.message.update({
            where: { id: msg.id },
            data: { twilioSid: exactId }
          }).catch((err) => console.error("Failed to update message twilioSid:", err));
        }
      }
    } else {
      // 1. Anti-Ban Human Simulation: Fire presence: "composing" to show "typing..." on recipient's phone
      try {
        const presenceRes = await fetch(`${EVO_URL}/chat/sendPresence/${EVO_INSTANCE}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: EVO_KEY,
          },
          body: JSON.stringify({
            number: `${toPhone}@s.whatsapp.net`,
            presence: "composing",
            delay: 10000,
          }),
        });
        if (!presenceRes.ok) {
          const errText = await presenceRes.text();
          console.warn(`Evolution API sendPresence HTTP ${presenceRes.status}:`, errText);
        }
      } catch (presenceErr) {
        console.warn("Evolution API sendPresence failed:", presenceErr);
      }

      // 2. Anti-Ban Human Simulation: Randomized artificial human delay between 4s and 12s
      const humanDelayMs = Math.floor(Math.random() * (12000 - 4000 + 1) + 4000);
      console.log(`[Anti-Ban] Simulating human typing delay of ${humanDelayMs}ms before dispatching message to ${toPhone}`);
      await new Promise((resolve) => setTimeout(resolve, humanDelayMs));

      // 3. Dispatch outbound text message
      const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVO_KEY
        },
        body: JSON.stringify({
          number: toPhone,
          options: {
            delay: 1200,
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
      const exactId = extractWhatsAppMessageId(evoData);
      if (exactId) {
        await prisma.message.update({
          where: { id: msg.id },
          data: { twilioSid: exactId }
        }).catch((err) => console.error("Failed to update message twilioSid:", err));
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


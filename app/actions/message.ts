"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

const EVO_URL = process.env.EVO_API_URL || "http://143.198.182.24:8080";
const EVO_KEY = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
const EVO_INSTANCE = process.env.EVO_INSTANCE || "arabic-talent-instance";

export interface SentMessage {
  id:        string;
  body:      string;
  direction: "INBOUND" | "OUTBOUND";
  sentAt:    string;
  senderName: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

/** Saves an outbound message to the database and sends it via Evolution API. */
export async function sendMessage(
  leadId: string,
  body:   string,
  mediaBase64?: string,
  mediaType?: string
): Promise<SentMessage> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Unauthorised");

  const user = await verifyToken(token);
  if (!user) throw new Error("Unauthorised");

  // Row-level guard: Fetch lead
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, phone: true, assignedAgentId: true }
  });

  if (!lead) throw new Error("Lead not found");

  if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
    throw new Error("Access denied: Not your lead");
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

  // If there's media, we construct the local proxy URL using the generated message ID
  if (mediaBase64) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const mediaUrl = `${appUrl}/api/media/${msg.id}`;
    
    msg = await prisma.message.update({
      where: { id: msg.id },
      data: { mediaUrl },
      select: {
        id: true, body: true, direction: true, sentAt: true, sentBy: { select: { name: true } }, mediaUrl: true, mediaType: true
      }
    });

    // Clean phone for WhatsApp integration (strip everything except digits)
    const toPhone = lead.phone.replace(/\D/g, "");

    try {
      if (mediaBase64) {
        // Send Media
        const parts = mediaBase64.split(",");
        const base64Data = parts.length > 1 ? parts[1] : parts[0];
        // Guess mimetype if not provided
        let mType = mediaType || "application/octet-stream";
        if (parts.length > 1 && parts[0].includes("data:")) {
          mType = parts[0].split(";")[0].split(":")[1];
        }

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
            mediatype: mType.includes("image") ? "image" : mType.includes("video") ? "video" : mType.includes("audio") ? "audio" : "document",
            caption: body.trim() || "",
            media: base64Data
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Evolution API Error: ${res.status} ${errText}`);
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
          throw new Error(`Evolution API Error: ${res.status} ${errText}`);
        }
      }
    } catch (err: any) {
      console.error("Failed to send message via Evolution API:", err.message);
      
      // Update DB status to FAILED
      await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
      throw new Error(`Evolution Error: ${err.message}`);
    }

  return {
    id:         msg.id,
    body:       msg.body,
    direction:  msg.direction,
    sentAt:     msg.sentAt.toISOString(),
    senderName: msg.sentBy?.name ?? null,
    mediaUrl:   msg.mediaUrl,
    mediaType:  msg.mediaType,
  };
}

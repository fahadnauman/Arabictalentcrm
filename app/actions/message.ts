"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { twilioClient, twilioPhone } from "@/lib/twilio";

export interface SentMessage {
  id:        string;
  body:      string;
  direction: "INBOUND" | "OUTBOUND";
  sentAt:    string;
  senderName: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
}

/** Saves an outbound message to the database and sends it via Twilio. */
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

    // Attempt to send the media URL via Twilio as well
    if (twilioClient) {
      const toPhone = lead.phone.startsWith("whatsapp:") ? lead.phone : `whatsapp:${lead.phone}`;
      const fromPhone = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
      try {
        await twilioClient.messages.create({
          body: body.trim() || "Sent an attachment",
          from: fromPhone,
          to: toPhone,
          mediaUrl: [mediaUrl]
        });
      } catch (err: any) {
        console.error("Failed to send attachment via Twilio:", err.message);
        
        // Update DB status to FAILED
        await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
        throw new Error(`Twilio Error: ${err.message}`);
      }
    }
  } else {
    // Standard text message via Twilio
    if (twilioClient) {
      const toPhone = lead.phone.startsWith("whatsapp:") ? lead.phone : `whatsapp:${lead.phone}`;
      const fromPhone = twilioPhone.startsWith("whatsapp:") ? twilioPhone : `whatsapp:${twilioPhone}`;
      try {
        await twilioClient.messages.create({
          body: body.trim(),
          from: fromPhone,
          to: toPhone
        });
      } catch (err: any) {
        console.error("Failed to send text message via Twilio:", err.message);
        
        // Update DB status to FAILED
        await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
        throw new Error(`Twilio Error: ${err.message}`);
      }
    }
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

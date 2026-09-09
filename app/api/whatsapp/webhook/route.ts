import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Evolution API sends different events. We only care about messages.upsert
    if (payload.event !== "messages.upsert") {
      return NextResponse.json({ success: true });
    }

    const data = payload.data;
    if (!data || !data.key || data.key.fromMe) {
      // Ignore our own outbound messages or malformed payloads
      return NextResponse.json({ success: true });
    }

    const remoteJid = data.key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) {
      // Ignore group messages for now
      return NextResponse.json({ success: true });
    }

    // Clean phone number
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("+", "");
    const messageSid = data.key.id;
    const profileName = data.pushName || "Unknown WhatsApp User";

    // Extract text body
    let body = "";
    if (data.message?.conversation) {
      body = data.message.conversation;
    } else if (data.message?.extendedTextMessage?.text) {
      body = data.message.extendedTextMessage.text;
    }

    // Media handling (Evolution API sends base64 if enabled, or just the mediaType)
    // We'll leave mediaUrl null for now since Evolution media downloads require extra API calls
    // unless base64 is explicitly included in the webhook.
    const messageType = data.messageType;
    let mediaUrl = null;
    let mediaType = null;
    if (messageType === "imageMessage" || messageType === "videoMessage" || messageType === "audioMessage" || messageType === "documentMessage") {
      mediaType = messageType;
      if (!body) body = "Media Attachment";
    }

    // 1. Match the clean phone number against the Prisma lead table
    let lead = await prisma.lead.findUnique({
      where: { phone },
    });

    if (!lead) {
      // If the lead doesn't exist, create a new one to log the message against
      const { getNextAgentInRotation, extractCampaignLanguage } = await import("@/lib/roundRobin");
      
      const requiredLang = extractCampaignLanguage("", body, profileName);
      const assignment = await getNextAgentInRotation(requiredLang);
      const assignedAgentId = assignment?.agentId || null;

      lead = await prisma.lead.create({
        data: {
          name: profileName,
          phone,
          status: "NEW_LEAD",
          source: "whatsapp",
          assignedAgentId,
          firstAssignedAt: assignedAgentId ? new Date() : null,
        }
      });

      // Log assignment
      if (assignment) {
        await prisma.leadAssignment.create({
          data: {
            leadId:       lead.id,
            assignedToId: assignment.agentId,
            assignedBy:   "round_robin_evolution",
          },
        });
      }
    }

    // 2. Log the incoming message to the lead's timeline
    await prisma.message.upsert({
      where: { twilioSid: messageSid },
      update: {}, // Prevent duplicate processing
      create: {
        twilioSid: messageSid,
        leadId: lead.id,
        body,
        direction: "INBOUND",
        status: "RECEIVED",
        mediaUrl,
        mediaType,
      }
    });

    // 3. Return 200 OK JSON response
    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CRITICAL] Evolution Webhook Error:", error);
    // Evolution API expects 200 OK even if we fail, to avoid retrying endlessly, 
    // but 500 is good for debugging.
    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }
}

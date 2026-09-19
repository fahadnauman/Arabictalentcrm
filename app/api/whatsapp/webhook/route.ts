import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // Evolution API sends different events. We only care about messages.upsert
    if (payload.event !== "messages.upsert") {
      return NextResponse.json({ success: true });
    }

    let data = payload.data;
    
    // Evolution API sometimes sends data as an array
    if (Array.isArray(data)) {
      data = data[0];
    }
    
    // In Evolution API v2, the message is often nested under data.message
    const messageData = data?.message?.key ? data.message : data;

    if (!messageData || !messageData.key || messageData.key.fromMe) {
      // Ignore our own outbound messages or malformed payloads
      return NextResponse.json({ success: true });
    }

    const remoteJid = messageData.key.remoteJid;
    if (!remoteJid || remoteJid.includes("@g.us")) {
      // Ignore group messages for now
      return NextResponse.json({ success: true });
    }

    // Clean phone number
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("+", "");
    const messageSid = messageData.key.id;
    const profileName = messageData.pushName || "Unknown WhatsApp User";

    // Extract text body or media caption
    let body = "";
    if (messageData.message?.conversation) {
      body = messageData.message.conversation;
    } else if (messageData.message?.extendedTextMessage?.text) {
      body = messageData.message.extendedTextMessage.text;
    } else if (messageData.message?.imageMessage?.caption) {
      body = messageData.message.imageMessage.caption;
    } else if (messageData.message?.videoMessage?.caption) {
      body = messageData.message.videoMessage.caption;
    } else if (messageData.message?.documentMessage?.caption) {
      body = messageData.message.documentMessage.caption;
    }

    // Media handling
    const messageType = messageData.messageType || Object.keys(messageData.message || {})[0];
    let mediaUrl = null;
    let mediaType = null;
    let rawPayload: any = null;

    if (
      messageType === "imageMessage" ||
      messageType === "videoMessage" ||
      messageType === "audioMessage" ||
      messageType === "documentMessage" ||
      messageType?.includes("image") ||
      messageType?.includes("audio") ||
      messageType?.includes("video") ||
      messageType?.includes("document")
    ) {
      const msgObj = messageData.message?.[messageType] || {};
      const mime = msgObj.mimetype || (
        messageType.includes("image") ? "image/jpeg" :
        messageType.includes("audio") ? "audio/ogg; codecs=opus" :
        messageType.includes("video") ? "video/mp4" :
        "application/pdf"
      );
      mediaType = mime;

      if (!body) body = "Media Attachment";

      // Extract base64 if provided by Evolution API webhook (with webhookBase64: true)
      const base64Data = 
        payload.data?.base64 || 
        messageData.base64 || 
        msgObj.base64 || 
        payload.base64;

      if (base64Data) {
        rawPayload = {
          type: "attachment",
          base64: base64Data,
          message: messageData
        };
      } else {
        rawPayload = {
          type: "attachment",
          message: messageData
        };
      }
    }

    // 1. Match the clean phone number against the Prisma lead table
    let isNewLead = false;
    let lead = await prisma.lead.findUnique({
      where: { phone },
    });

    if (!lead) {
      isNewLead = true;
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
        rawPayload,
      }
    });

    // 3. Sunday / Out of Office Auto-Responder check for newly created leads
    if (isNewLead) {
      try {
        const now = new Date();
        const gstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dubai" }));
        const dayOfWeek = gstDate.getDay(); // 0 = Sunday
        const hour = gstDate.getHours();    // 0 - 23

        // Trigger if Sunday or outside configured working hours (09:00 - 19:00 GST)
        const isSunday = dayOfWeek === 0;
        const isOffHours = hour < 9 || hour >= 19;

        if (isSunday || isOffHours) {
          const reasonText = isSunday
            ? "today is Sunday"
            : "outside our regular business hours: 9:00 AM – 7:00 PM GST";
          const autoReplyText = `Thank you for contacting Arabic Talent! Our admissions office is currently closed (${reasonText}). Your inquiry has been safely received, and our academic counselor will reach out to you first thing on the next business day.`;

          const evoUrl = process.env.EVO_API_URL || "http://143.198.182.24:8080";
          const evoKey = process.env.EVO_API_KEY || "arabictalent-api-key-2024";
          const evoInstance = process.env.EVO_INSTANCE || "arabic-talent-prod";

          // Dispatch automatic WhatsApp reply via Evolution API
          const sendRes = await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": evoKey,
            },
            body: JSON.stringify({
              number: phone,
              options: { delay: 1000, presence: "composing" },
              text: autoReplyText,
            }),
          });

          if (sendRes.ok) {
            // Log outbound auto-responder message to lead timeline
            await prisma.message.create({
              data: {
                leadId: lead.id,
                body: autoReplyText,
                direction: "OUTBOUND",
                status: "SENT",
                sentById: null,
              },
            });
          } else {
            console.warn("Evolution API auto-responder dispatch returned status:", sendRes.status);
          }
        }
      } catch (autoErr) {
        console.error("Error in out-of-office auto-responder:", autoErr);
      }
    }

    // 4. Return 200 OK JSON response
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

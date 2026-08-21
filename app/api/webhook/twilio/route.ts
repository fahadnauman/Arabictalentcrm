import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAgentInRotation, extractCampaignLanguage } from "@/lib/roundRobin";

// Twilio sends data as application/x-www-form-urlencoded
export async function POST(req: Request) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const fromRaw = params.get("From") || ""; // e.g. "whatsapp:+971501234567"
    let body = params.get("Body") || "";
    const messageSid = params.get("MessageSid") || "";
    const profileName = params.get("ProfileName") || "Unknown";
    const campaignParam = params.get("Campaign") || params.get("keyword") || params.get("language") || "";

    const numMedia = parseInt(params.get("NumMedia") || "0", 10);
    const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
    const mediaType = numMedia > 0 ? params.get("MediaContentType0") : null;

    if (!body && mediaUrl) {
      body = "Media Attachment";
    }

    if (!fromRaw || !body) {
      return NextResponse.json({ error: "Missing From or Body" }, { status: 400 });
    }

    // Strip "whatsapp:" prefix for our DB
    const phone = fromRaw.replace("whatsapp:", "");

    // 1. Check if lead exists
    let lead = await prisma.lead.findUnique({
      where: { phone },
    });

    if (!lead) {
      // 2. New Lead -> Round Robin Engine (filtered by campaign language)
      const requiredLang = extractCampaignLanguage(campaignParam, body, profileName);
      const assignment = await getNextAgentInRotation(requiredLang);
      const assignedAgentId = assignment?.agentId || null;

      // Create the lead
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
            assignedBy:   "round_robin_twilio",
          },
        });
      }
    }

    // 3. Save the inbound message
    const originalSender = params.get("OriginalRepliedMessageSender") || "";
    const isStatusReply = originalSender.includes("whatsapp:status");

    await prisma.message.upsert({
      where: { twilioSid: messageSid },
      update: {}, // if twilio sends a duplicate webhook, do nothing
      create: {
        twilioSid: messageSid,
        leadId: lead.id,
        body,
        direction: "INBOUND",
        status: "RECEIVED",
        isStatusReply,
        mediaUrl,
        mediaType,
      }
    });

    // 4. Return success to Twilio (Twilio expects 200 OK)
    // We could return TwiML here, but we're handling replies asynchronously via the Agent UI.
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" }
    });

  } catch (error: any) {
    console.error("[CRITICAL] Twilio Webhook Error:", {
      message: error.message || "Unknown error",
      stack: error.stack,
      raw: error
    });
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);

    const fromRaw = params.get("From");
    const body = params.get("Body");
    const messageSid = params.get("MessageSid") || `msg_${Date.now()}`;
    const profileName = params.get("ProfileName") || "Unknown WhatsApp User";

    // Media handling
    const numMedia = parseInt(params.get("NumMedia") || "0", 10);
    const mediaUrl = numMedia > 0 ? params.get("MediaUrl0") : null;
    const mediaType = numMedia > 0 ? params.get("MediaContentType0") : null;

    if (!fromRaw) {
      return NextResponse.json({ error: "Missing 'From' parameter in payload" }, { status: 400 });
    }

    // Clean phone number (strip 'whatsapp:' prefix)
    const phone = fromRaw.replace("whatsapp:", "");

    // 1. Match the clean phone number against the Prisma lead table
    let lead = await prisma.lead.findUnique({
      where: { phone },
    });

    if (!lead) {
      // If the lead doesn't exist, create a new one to log the message against
      lead = await prisma.lead.create({
        data: {
          name: profileName,
          phone,
          status: "NEW_LEAD",
          source: "whatsapp",
        }
      });
    }

    // 2. Log the incoming message to the lead's timeline
    await prisma.message.upsert({
      where: { twilioSid: messageSid },
      update: {}, // Prevent duplicate processing if Twilio retries the webhook
      create: {
        twilioSid: messageSid,
        leadId: lead.id,
        body: body || (mediaUrl ? "Media Attachment" : ""),
        direction: "INBOUND",
        status: "RECEIVED",
        mediaUrl,
        mediaType,
      }
    });

    // 3. Return 200 OK with empty TwiML response as expected by Twilio
    return new NextResponse("<Response></Response>", {
      status: 200,
      headers: { "Content-Type": "text/xml" }
    });

  } catch (error: any) {
    console.error("[CRITICAL] WhatsApp Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

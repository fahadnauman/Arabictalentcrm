import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import twilio from "twilio";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== "AGENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { leadId } = await req.json();
    if (!leadId) {
      return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
    }

    // 1. Fetch Agent
    const agent = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!agent?.phone) {
      return NextResponse.json({ error: "Agent phone number is not configured" }, { status: 400 });
    }

    // 2. Fetch Lead
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead?.phone) {
      return NextResponse.json({ error: "Lead phone number is missing" }, { status: 400 });
    }

    // 3. Initiate Twilio Call
    // Ensure these env variables are set in production
    const accountSid = process.env.TWILIO_ACCOUNT_SID || "dummy_sid";
    const authToken = process.env.TWILIO_AUTH_TOKEN || "dummy_token";
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER || "+1234567890";
    
    // In dev, if twilio is not configured, simulate success
    if (accountSid === "dummy_sid") {
      console.log(`[Mock Call] Dialing agent ${agent.phone} then bridging to lead ${lead.phone}`);
      return NextResponse.json({ success: true, message: "Call initiated (Mock)" });
    }

    const client = twilio(accountSid, authToken);

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const voiceUrl = `${protocol}://${host}/api/voice?leadPhone=${encodeURIComponent(lead.phone)}`;

    const call = await client.calls.create({
      to: agent.phone,     // Call the agent first
      from: twilioNumber,  // From our Twilio number
      url: voiceUrl,       // Bridge to the lead via webhook
    });

    return NextResponse.json({ success: true, callSid: call.sid });

  } catch (error: any) {
    console.error("[CRITICAL] Call Initiation Error:", error);
    return NextResponse.json({ error: "Failed to initiate call" }, { status: 500 });
  }
}

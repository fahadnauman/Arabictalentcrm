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

    const agentPhone = agent?.phone || "+919037953712";

    if (!agentPhone) {
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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioNumber) {
      console.error("[CRITICAL] Missing Twilio Environment Variables");
      return NextResponse.json({ error: "Twilio configuration is missing on the server" }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    const call = await client.calls.create({
      to: agentPhone,      // Call the agent first
      from: twilioNumber,  // From our Twilio number
      twiml: `<Response><Say>Connecting to lead.</Say><Dial>${lead.phone}</Dial></Response>`,
    });

    return NextResponse.json({ success: true, callSid: call.sid });

  } catch (error: any) {
    console.error("[CRITICAL] Call Initiation Error:", error);
    console.error("Twilio Error Details:", error?.message, error?.code, error?.moreInfo);
    
    return NextResponse.json({ 
      error: error?.message || "Failed to initiate call",
      code: error?.code,
      details: error?.moreInfo || error
    }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const leadPhone = url.searchParams.get("leadPhone");

    let twiml = `<?xml version="1.0" encoding="UTF-8"?><Response>`;
    
    if (leadPhone) {
      // Announce the connection and dial the lead
      twiml += `<Say>Connecting to lead.</Say><Dial>${leadPhone}</Dial>`;
    } else {
      twiml += `<Say>Welcome to the Arabic Talent CRM. We could not route your call.</Say>`;
    }

    twiml += `</Response>`;

    return new NextResponse(twiml, {
      headers: {
        "Content-Type": "text/xml",
      },
    });
  } catch (error) {
    console.error("[CRITICAL] Voice Route Error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred.</Say></Response>`,
      { status: 500, headers: { "Content-Type": "text/xml" } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceParam = req.nextUrl.searchParams.get("since");
  let sinceDate: Date | null = null;
  if (sinceParam) {
    const parsed = new Date(sinceParam);
    if (!isNaN(parsed.getTime())) {
      sinceDate = parsed;
    }
  }

  try {
    const leads = await prisma.lead.findMany({
      where: sinceDate
        ? {
            createdAt: {
              gt: sinceDate,
            },
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        company: true,
        source: true,
        status: true,
        createdAt: true,
        assignedAgentId: true,
      },
    });

    return NextResponse.json({
      leads,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[GET /api/leads/latest] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch latest leads" },
      { status: 500 }
    );
  }
}

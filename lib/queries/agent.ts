import { prisma } from "@/lib/prisma";
import { LeadStatus } from "@prisma/client";

// ── Sale chance % by pipeline status ─────────────────────────────────────
export const SALE_CHANCE: Record<string, number> = {
  CLOSED:         100,
  INTERESTED:      90,
  THINKING:        60,
  NEW_LEAD:        35,
  NO_RESPONSE:     15,
  NOT_INTERESTED:   5,
};

// ── Agent home stats ─────────────────────────────────────────────────────
export async function getAgentStats(agentId: string) {
  const [totalLeads, closedLeads, revenue, statusCounts] = await Promise.all([
    prisma.lead.count({ where: { assignedAgentId: agentId } }),

    prisma.lead.count({
      where: { assignedAgentId: agentId, status: LeadStatus.CLOSED },
    }),

    prisma.lead.aggregate({
      where: { assignedAgentId: agentId, status: LeadStatus.CLOSED },
      _sum: { dealValueCents: true },
    }),

    prisma.lead.groupBy({
      by: ["status"],
      where: { assignedAgentId: agentId },
      _count: { status: true },
    }),
  ]);

  const revenueAED = Number(revenue._sum.dealValueCents ?? 0) / 100;

  const breakdown = Object.fromEntries(
    statusCounts.map((r) => [r.status, r._count.status])
  ) as Record<string, number>;

  return { totalLeads, closedLeads, revenueAED, breakdown };
}

// ── Agent pipeline list ──────────────────────────────────────────────────
export async function getAgentLeads(agentId: string) {
  return prisma.lead.findMany({
    where: { assignedAgentId: agentId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id:             true,
      name:           true,
      phone:          true,
      company:        true,
      status:         true,
      dealValueCents: true,
      createdAt:      true,
      updatedAt:      true,
    },
  });
}

// ── Single lead + its messages (for chat view) ───────────────────────────
export async function getLeadWithMessages(leadId: string, agentId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId },
    include: {
      messages: {
        orderBy: { sentAt: "asc" },
        select: {
          id:        true,
          body:      true,
          direction: true,
          sentAt:    true,
          isStatusReply: true,
          mediaUrl:  true,
          mediaType: true,
          sentBy:    { select: { name: true } },
        },
      },
    },
  });
}

// ── Agent analytics (Step 5) ─────────────────────────────────────────────
export async function getAgentAnalytics(agentId: string) {
  // 1. Total Session Hours
  const sessions = await prisma.agentSession.findMany({
    where: { agentId }
  });
  
  let totalSessionMs = 0;
  for (const s of sessions) {
    const end = s.clockOut ? s.clockOut.getTime() : Date.now();
    totalSessionMs += (end - s.clockIn.getTime());
  }
  const totalWorkingHours = totalSessionMs / (1000 * 60 * 60);

  // 2. Average Response Time & Total Conv Duration
  const leads = await prisma.lead.findMany({
    where: { assignedAgentId: agentId },
    select: {
      id: true,
      messages: {
        orderBy: { sentAt: "asc" },
        select: { direction: true, sentAt: true }
      }
    }
  });

  let responseTimes: number[] = [];
  let totalConvMs = 0;

  for (const lead of leads) {
    if (lead.messages.length === 0) continue;
    
    // Conversation duration
    const firstMsg = lead.messages[0].sentAt.getTime();
    const lastMsg = lead.messages[lead.messages.length - 1].sentAt.getTime();
    totalConvMs += (lastMsg - firstMsg);

    // Response times
    let pendingInboundTime: number | null = null;
    
    for (const msg of lead.messages) {
      if (msg.direction === "INBOUND") {
        if (!pendingInboundTime) pendingInboundTime = msg.sentAt.getTime();
      } else if (msg.direction === "OUTBOUND" && pendingInboundTime) {
        responseTimes.push(msg.sentAt.getTime() - pendingInboundTime);
        pendingInboundTime = null;
      }
    }
  }

  const avgResponseTimeMs = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    workingHours: totalWorkingHours,
    avgResponseMins: avgResponseTimeMs / (1000 * 60),
    convDurationHours: totalConvMs / (1000 * 60 * 60),
  };
}

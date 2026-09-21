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
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [
    totalLeads,
    closedLeads,
    followUpLeadsCount,
    newLeadsCount,
    statusCounts,
    temperatureCounts,
    todayFollowUps,
    todayNewLeads,
    todayClosedDeals,
    todayTempCounts,
    closedLeadsData,
  ] = await Promise.all([
    prisma.lead.count({ where: { assignedAgentId: agentId } }),

    prisma.lead.count({
      where: { assignedAgentId: agentId, status: LeadStatus.CLOSED },
    }),

    prisma.lead.count({
      where: {
        assignedAgentId: agentId,
        OR: [
          { status: LeadStatus.FOLLOWUP },
          { followUps: { some: { status: "PENDING" } } },
        ],
      },
    }),

    prisma.lead.count({
      where: { assignedAgentId: agentId, status: LeadStatus.NEW_LEAD },
    }),

    prisma.lead.groupBy({
      by: ["status"],
      where: { assignedAgentId: agentId },
      _count: { status: true },
    }),

    prisma.lead.groupBy({
      by: ["temperature"],
      where: { assignedAgentId: agentId },
      _count: { temperature: true },
    }),

    prisma.followUp.count({
      where: {
        agentId,
        scheduledAt: { gte: startOfToday, lte: endOfToday },
      },
    }),

    prisma.lead.count({
      where: {
        assignedAgentId: agentId,
        createdAt: { gte: startOfToday },
      },
    }),

    prisma.lead.count({
      where: {
        assignedAgentId: agentId,
        status: LeadStatus.CLOSED,
        closedAt: { gte: startOfToday },
      },
    }),

    prisma.lead.groupBy({
      by: ["temperature"],
      where: {
        assignedAgentId: agentId,
        createdAt: { gte: startOfToday },
      },
      _count: { temperature: true },
    }),

    prisma.lead.findMany({
      where: { assignedAgentId: agentId, status: LeadStatus.CLOSED },
      select: {
        dealValueCents: true,
        paymentStatus: true,
        partialPaymentAmount: true,
      },
    }),
  ]);

  // Breakdown by status
  const breakdown = Object.fromEntries(
    statusCounts.map((r) => [r.status, r._count.status])
  ) as Record<string, number>;

  // Temperature breakdowns
  const tempMap = { HOT: 0, WARM: 0, COLD: 0 };
  for (const t of temperatureCounts) {
    if (t.temperature in tempMap) {
      tempMap[t.temperature as keyof typeof tempMap] = t._count.temperature;
    }
  }

  const todayTempMap = { HOT: 0, WARM: 0, COLD: 0 };
  for (const t of todayTempCounts) {
    if (t.temperature in todayTempMap) {
      todayTempMap[t.temperature as keyof typeof todayTempMap] = t._count.temperature;
    }
  }

  // Revenue & Partial Payments calculation
  let fullRevenueAED = 0;
  let partialCollectedAED = 0;
  let partialBalanceDueAED = 0;
  let fullDealsCount = 0;
  let partialDealsCount = 0;

  for (const deal of closedLeadsData) {
    const totalValAED = Number(deal.dealValueCents || 0) / 100;
    if (deal.paymentStatus === "PARTIAL") {
      partialDealsCount++;
      const collected = Number(deal.partialPaymentAmount || 0);
      partialCollectedAED += collected;
      partialBalanceDueAED += Math.max(0, totalValAED - collected);
    } else {
      fullDealsCount++;
      fullRevenueAED += totalValAED;
    }
  }

  const totalCashCollectedAED = fullRevenueAED + partialCollectedAED;

  return {
    totalLeads,
    closedLeads,
    followUpLeadsCount,
    newLeadsCount,
    revenueAED: totalCashCollectedAED,
    breakdown,
    temperatureBreakdown: tempMap,
    todayOverview: {
      todayFollowUps,
      todayNewLeads,
      todayClosedDeals,
      temperatureBreakdown: todayTempMap,
    },
    revenueTracking: {
      totalCashCollectedAED,
      fullRevenueAED,
      partialCollectedAED,
      partialBalanceDueAED,
      fullDealsCount,
      partialDealsCount,
    },
  };
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
      followUps: {
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: {
          id: true,
          scheduledAt: true,
          note: true,
        },
      },
    },
  });
}

// ── Single lead + its messages (for chat view) ───────────────────────────
export async function getLeadWithMessages(leadId: string, agentId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId },
    include: {
      followUps: {
        where: { status: "PENDING" },
        orderBy: { scheduledAt: "asc" },
      },
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

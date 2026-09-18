import { prisma } from "@/lib/prisma";
import { LeadStatus, Role } from "@prisma/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AgentPerformance {
  id: string;
  name: string;
  isActive: boolean;
  totalLeads: number;
  closed: number;
  pending: number;
  lost: number;
  revenueGeneratedCents: number;
}

export interface AdminStats {
  totalLeads:    number;
  closedDeals:   number;
  activeAgents:  number;
  winRate:       number; // percentage 0-100
  totalRevenueCents: number;
  statusBreakdown: {
    NEW_LEAD:       number;
    THINKING:       number;
    NOT_INTERESTED: number;
    NO_RESPONSE:    number;
    CLOSED:         number;
  };
  recentLeads: RecentLead[];
  agentPerformance: AgentPerformance[];
}

export interface RecentLead {
  id:           string;
  name:         string;
  phone:        string;
  status:       string;
  agentName:    string | null;
  createdAt:    Date;
}

// ── Main query — runs all counts in a single round-trip ───────────────────

export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalLeads,
    closedDeals,
    activeAgents,
    countNewLead,
    countThinking,
    countNotInterested,
    countNoResponse,
    recentLeadRows,
    agentRows,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: LeadStatus.CLOSED } }),
    prisma.user.count({ where: { role: Role.AGENT, isActive: true } }),
    prisma.lead.count({ where: { status: LeadStatus.NEW_LEAD } }),
    prisma.lead.count({ where: { status: LeadStatus.THINKING } }),
    prisma.lead.count({ where: { status: LeadStatus.NOT_INTERESTED } }),
    prisma.lead.count({ where: { status: LeadStatus.NO_RESPONSE } }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id:        true,
        name:      true,
        phone:     true,
        status:    true,
        createdAt: true,
        assignedAgent: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: Role.AGENT },
      select: {
        id: true,
        name: true,
        isActive: true,
        assignedLeads: {
          select: {
            status: true,
            dealValueCents: true,
          }
        }
      }
    })
  ]);

  const winRate = totalLeads > 0
    ? Math.round((closedDeals / totalLeads) * 100)
    : 0;

  const agentPerformance = agentRows.map(agent => {
    let closed = 0;
    let pending = 0;
    let lost = 0;
    let revenue = 0n;

    for (const lead of agent.assignedLeads) {
      if (lead.status === "CLOSED") {
        closed++;
        if (lead.dealValueCents) revenue += lead.dealValueCents;
      } else if (lead.status === "NEW_LEAD" || lead.status === "THINKING") {
        pending++;
      } else if (lead.status === "NOT_INTERESTED" || lead.status === "NO_RESPONSE") {
        lost++;
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      isActive: agent.isActive,
      totalLeads: agent.assignedLeads.length,
      closed,
      pending,
      lost,
      revenueGeneratedCents: Number(revenue)
    };
  });

  const totalRevenueCents = agentPerformance.reduce((sum, agent) => sum + agent.revenueGeneratedCents, 0);

  return {
    totalLeads,
    closedDeals,
    activeAgents,
    winRate,
    totalRevenueCents,
    statusBreakdown: {
      NEW_LEAD:       countNewLead,
      THINKING:       countThinking,
      NOT_INTERESTED: countNotInterested,
      NO_RESPONSE:    countNoResponse,
      CLOSED:         closedDeals,
    },
    recentLeads: recentLeadRows.map((l) => ({
      id:        l.id,
      name:      l.name,
      phone:     l.phone,
      status:    l.status,
      agentName: l.assignedAgent?.name ?? null,
      createdAt: l.createdAt,
    })),
    agentPerformance,
  };
}

export interface ActivityFeedItem {
  id: string;
  type: "TRANSFER" | "ASSIGNMENT" | "TASK" | "SYSTEM";
  message: string;
  actorName: string;
  occurredAt: Date;
  metadata?: any;
}

export async function getRecentActivityFeed(limit = 12): Promise<ActivityFeedItem[]> {
  const [auditLogs, leadAssignments] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        action: { in: ["lead.transferred", "lead.assigned", "task.assigned"] }
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    }),
    prisma.leadAssignment.findMany({
      orderBy: { assignedAt: "desc" },
      take: limit,
      include: {
        lead: { select: { name: true, phone: true } },
      }
    })
  ]);

  const items: ActivityFeedItem[] = [];

  for (const log of auditLogs) {
    const meta = (log.metadata || {}) as any;
    if (log.action === "lead.transferred") {
      const from = meta.fromAgentName || "Unassigned";
      const to = meta.toAgentName || "Agent";
      const lead = meta.leadName || "Lead";
      const actor = meta.actorName || "Admin";
      items.push({
        id: log.id,
        type: "TRANSFER",
        message: `${actor} transferred Lead ${lead} from ${from} to ${to}`,
        actorName: actor,
        occurredAt: log.occurredAt,
        metadata: meta,
      });
    }
  }

  // Fall back to lead assignment logs if no manual transfers recorded yet
  if (items.length === 0) {
    for (const assign of leadAssignments) {
      items.push({
        id: assign.id,
        type: "ASSIGNMENT",
        message: `${assign.assignedBy || "Round-Robin"} routed Lead ${assign.lead?.name || "New Contact"} to agent queue`,
        actorName: assign.assignedBy || "System",
        occurredAt: assign.assignedAt,
        metadata: { leadName: assign.lead?.name },
      });
    }
  }

  return items.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit);
}

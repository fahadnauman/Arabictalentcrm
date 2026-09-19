"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export interface AgentDailyLeadCount {
  agentId: string;
  agentName: string;
  leadCountToday: number;
}

export interface AuditEvent {
  id: string;
  eventType: "LEAD_INTAKE" | "TRANSFER" | "STATUS_CHANGE" | "TASK_COMPLETED" | "TASK_CREATED";
  title: string;
  description: string;
  actor: string;
  timestamp: Date;
  badgeColor: string;
  badgeText: string;
  metadata?: any;
}

export interface FullAuditTrailResponse {
  events: AuditEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  todayAgentSummaries: AgentDailyLeadCount[];
  totalTransfers: number;
  totalStatusChanges: number;
  totalCompletedTasks: number;
}

export async function getFullAuditTrail({
  page = 1,
  pageSize = 15,
  filterType = "ALL",
}: {
  page?: number;
  pageSize?: number;
  filterType?: string;
}): Promise<FullAuditTrailResponse> {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    throw new Error("Unauthorized. Only administrators can access the full audit trail.");
  }

  // 1. Calculate today's time boundary
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // 2. Fetch active agents and lead intake counts for today
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true },
  });

  const todayAssignments = await prisma.leadAssignment.findMany({
    where: {
      assignedAt: { gte: startOfToday },
      assignedToId: { not: null },
    },
    select: { assignedToId: true },
  });

  const agentCountMap = new Map<string, number>();
  for (const a of agents) {
    agentCountMap.set(a.id, 0);
  }
  for (const asgn of todayAssignments) {
    if (asgn.assignedToId && agentCountMap.has(asgn.assignedToId)) {
      agentCountMap.set(asgn.assignedToId, (agentCountMap.get(asgn.assignedToId) || 0) + 1);
    }
  }

  const todayAgentSummaries: AgentDailyLeadCount[] = agents.map((a) => ({
    agentId: a.id,
    agentName: a.name,
    leadCountToday: agentCountMap.get(a.id) || 0,
  }));

  // 3. Collect historical audit events across tables
  const [transfers, statusHistories, tasks, leadAssignments] = await Promise.all([
    // Transfers & Closed Deals from AuditLog
    prisma.auditLog.findMany({
      where: { action: { in: ["lead.transferred", "lead.deal_closed"] } },
      orderBy: { occurredAt: "desc" },
      take: 150,
    }),
    // Status changes
    prisma.leadStatusHistory.findMany({
      orderBy: { changedAt: "desc" },
      take: 150,
      include: {
        lead: { select: { name: true, phone: true } },
      },
    }),
    // Tasks and directives
    prisma.taskAssignment.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      include: {
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
      },
    }),
    // Lead assignments
    prisma.leadAssignment.findMany({
      orderBy: { assignedAt: "desc" },
      take: 150,
      include: {
        lead: { select: { name: true, phone: true } },
      },
    }),
  ]);

  const allEvents: AuditEvent[] = [];

  // Add daily intake summaries as notable events if any leads arrived today
  for (const summary of todayAgentSummaries) {
    if (summary.leadCountToday > 0) {
      allEvents.push({
        id: `summary-${summary.agentId}-${startOfToday.toISOString()}`,
        eventType: "LEAD_INTAKE",
        title: `${summary.agentName} received ${summary.leadCountToday} lead${summary.leadCountToday > 1 ? "s" : ""} today`,
        description: `Automated round-robin intake distributed ${summary.leadCountToday} incoming customer leads to ${summary.agentName}.`,
        actor: "Round-Robin Engine",
        timestamp: new Date(),
        badgeColor: "#60a5fa",
        badgeText: "Lead Intake",
        metadata: { agentId: summary.agentId, count: summary.leadCountToday },
      });
    }
  }

  // Add manual transfers and closed sales from AuditLog
  for (const t of transfers) {
    const meta = (t.metadata || {}) as any;

    if (t.action === "lead.deal_closed") {
      const actor = meta.agentName || "Agent";
      const lead = meta.leadName || "Lead";
      const course = meta.courseType || "Course";
      const amount = meta.amountAED ? `AED ${Number(meta.amountAED).toLocaleString("en-AE")}` : "";

      allEvents.push({
        id: t.id,
        eventType: "STATUS_CHANGE",
        title: `Deal Closed: ${lead} (${course})`,
        description: `${actor} closed deal for ${lead} with course "${course}" for ${amount}. Payment status: ${meta.paymentStatus || "FULL"}.`,
        actor,
        timestamp: t.occurredAt,
        badgeColor: "#20C997",
        badgeText: "Closed Sale",
        metadata: meta,
      });
    } else {
      const lead = meta.leadName || "Customer Lead";
      const from = meta.fromAgentName || "Unassigned";
      const to = meta.toAgentName || "Agent";
      const actor = meta.actorName || "Admin";

      allEvents.push({
        id: t.id,
        eventType: "TRANSFER",
        title: `${actor} transferred ${lead} to ${to}`,
        description: `Manual override reassigned lead from ${from} to ${to}. Contact: ${meta.leadPhone || "N/A"}.`,
        actor,
        timestamp: t.occurredAt,
        badgeColor: "#20C997",
        badgeText: "Transfer",
        metadata: meta,
      });
    }
  }

  // Add pipeline status changes
  for (const sh of statusHistories) {
    const from = sh.fromStatus || "NEW_LEAD";
    const to = sh.toStatus;
    const leadName = sh.lead?.name || "Lead";

    allEvents.push({
      id: sh.id,
      eventType: "STATUS_CHANGE",
      title: `${leadName} status updated: ${from} → ${to}`,
      description: sh.note ? `Note: ${sh.note}` : `Pipeline status progressed from ${from} to ${to}.`,
      actor: sh.changedById || "Agent",
      timestamp: sh.changedAt,
      badgeColor: "#f59e0b",
      badgeText: "Status Change",
      metadata: { from, to, leadName, phone: sh.lead?.phone },
    });
  }

  // Add task creations and completions
  for (const task of tasks) {
    if (task.status === "COMPLETED" && task.completedAt) {
      allEvents.push({
        id: `task-comp-${task.id}`,
        eventType: "TASK_COMPLETED",
        title: `Task completed: "${task.message.slice(0, 45)}..."`,
        description: `Directive completed by ${task.receiver?.name || "Agent"}. Priority: ${task.priority}.`,
        actor: task.receiver?.name || "Agent",
        timestamp: task.completedAt,
        badgeColor: "#a855f7",
        badgeText: "Task Completed",
        metadata: { priority: task.priority },
      });
    }

    allEvents.push({
      id: `task-init-${task.id}`,
      eventType: "TASK_CREATED",
      title: `Directive dispatched: "${task.message.slice(0, 45)}..."`,
      description: `Dispatched to ${task.isBroadcast ? "All Agents" : task.receiver?.name || "Agent"} by ${task.sender?.name || "Admin"}.`,
      actor: task.sender?.name || "Admin",
      timestamp: task.createdAt,
      badgeColor: "#6366f1",
      badgeText: "Task Assigned",
      metadata: { isBroadcast: task.isBroadcast, priority: task.priority },
    });
  }

  // Add lead assignment events
  for (const asgn of leadAssignments) {
    if (!allEvents.some((e) => e.metadata?.leadId === asgn.leadId && e.eventType === "TRANSFER")) {
      allEvents.push({
        id: asgn.id,
        eventType: "LEAD_INTAKE",
        title: `Lead ${asgn.lead?.name || "New Contact"} assigned`,
        description: `Assigned via ${asgn.assignedBy || "round_robin"}. Contact: ${asgn.lead?.phone || "N/A"}.`,
        actor: asgn.assignedBy || "System",
        timestamp: asgn.assignedAt,
        badgeColor: "#00ffff",
        badgeText: "Assignment",
        metadata: { leadName: asgn.lead?.name },
      });
    }
  }

  // Sort strictly by timestamp DESC
  allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter if specific type chosen
  let filteredEvents = allEvents;
  if (filterType && filterType !== "ALL") {
    filteredEvents = allEvents.filter((e) => e.eventType === filterType);
  }

  // Pagination calculations
  const totalCount = filteredEvents.length;
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const paginatedEvents = filteredEvents.slice(startIndex, startIndex + safePageSize);

  const totalTransfers = allEvents.filter((e) => e.eventType === "TRANSFER").length;
  const totalStatusChanges = allEvents.filter((e) => e.eventType === "STATUS_CHANGE").length;
  const totalCompletedTasks = allEvents.filter((e) => e.eventType === "TASK_COMPLETED").length;

  return {
    events: paginatedEvents,
    totalCount,
    page: currentPage,
    pageSize: safePageSize,
    totalPages,
    todayAgentSummaries,
    totalTransfers,
    totalStatusChanges,
    totalCompletedTasks,
  };
}

"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { LeadStatus } from "@prisma/client";

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export interface CreateFollowUpInput {
  leadId: string;
  scheduledAt: string | Date;
  note: string;
  priority?: string;
}

export async function createFollowUp(input: CreateFollowUpInput) {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized. Please log in to schedule follow-ups.");
  }

  if (!input.leadId) {
    throw new Error("Lead ID is required.");
  }

  if (!input.scheduledAt) {
    throw new Error("Scheduled date and time are required.");
  }

  if (!input.note || !input.note.trim()) {
    throw new Error("Follow-up note cannot be empty.");
  }

  const scheduledDate = new Date(input.scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw new Error("Invalid scheduled date format.");
  }

  // Find the lead
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, name: true, phone: true, assignedAgentId: true, status: true },
  });

  if (!lead) {
    throw new Error("Lead not found.");
  }

  // If user is agent, ensure they own the lead or are admin
  if (user.role === "AGENT" && lead.assignedAgentId && lead.assignedAgentId !== user.id) {
    throw new Error("You are not assigned to this lead.");
  }

  const now = new Date();

  // Create FollowUp in database
  const followUp = await prisma.followUp.create({
    data: {
      leadId: lead.id,
      agentId: user.id,
      scheduledAt: scheduledDate,
      note: input.note.trim(),
      priority: input.priority || "MEDIUM",
      status: "PENDING",
    },
    include: {
      lead: { select: { id: true, name: true, phone: true } },
      agent: { select: { id: true, name: true } },
    },
  });

  // Update lead status to FOLLOWUP if not already closed
  if (lead.status !== LeadStatus.CLOSED) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: LeadStatus.FOLLOWUP,
        statusChangedAt: now,
      },
    });

    // Record in LeadStatusHistory
    await prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: LeadStatus.FOLLOWUP,
        changedById: user.id,
        note: `Follow-up scheduled for ${scheduledDate.toLocaleString()}: ${input.note.trim()}`,
      },
    });
  }

  // Audit log entry
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "lead.followup_scheduled",
        entityType: "FollowUp",
        entityId: followUp.id,
        metadata: {
          leadId: lead.id,
          leadName: lead.name,
          leadPhone: lead.phone,
          scheduledAt: scheduledDate.toISOString(),
          note: input.note.trim(),
          agentName: user.name,
        },
      },
    });
  } catch (logErr) {
    console.warn("Failed to write audit log for followup:", logErr);
  }

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath(`/dashboard/agent/chat/${lead.id}`);
  revalidatePath("/dashboard/admin");

  return {
    success: true,
    followUp: {
      id: followUp.id,
      leadId: followUp.leadId,
      leadName: followUp.lead.name,
      leadPhone: followUp.lead.phone,
      scheduledAt: followUp.scheduledAt,
      note: followUp.note,
      status: followUp.status,
    },
  };
}

export async function getAgentFollowUps(agentId?: string) {
  const user = await getAuthUser();
  if (!user) return [];

  const targetAgentId = user.role === "ADMIN" && agentId ? agentId : user.id;

  const followUps = await prisma.followUp.findMany({
    where: {
      ...(user.role === "ADMIN" && !agentId ? {} : { agentId: targetAgentId }),
      status: "PENDING",
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          company: true,
          status: true,
        },
      },
    },
  });

  return followUps;
}

export async function completeFollowUp(followUpId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const existing = await prisma.followUp.findUnique({
    where: { id: followUpId },
    select: { id: true, agentId: true, leadId: true },
  });

  if (!existing) throw new Error("Follow-up not found.");

  if (user.role === "AGENT" && existing.agentId !== user.id) {
    throw new Error("You can only complete your own follow-ups.");
  }

  await prisma.followUp.update({
    where: { id: followUpId },
    data: { status: "COMPLETED" },
  });

  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath(`/dashboard/agent/chat/${existing.leadId}`);

  return { success: true };
}

// ── Log Follow-Up Outcome (Chat Box 'Update Follow-Up' action) ───────────
export interface FollowUpOutcomeInput {
  leadId:           string;
  followUpId?:      string | null;
  outcomeStatus:    string; // 'Not Responding' | 'Interested' | 'Callback Requested' | custom
  outcomeNote:      string;
  nextScheduledAt?: string | Date | null;
  priority?:        string;
}

export async function logFollowUpOutcome(input: FollowUpOutcomeInput) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    select: { id: true, name: true, phone: true, assignedAgentId: true, status: true },
  });

  if (!lead) throw new Error("Lead not found.");
  if (user.role === "AGENT" && lead.assignedAgentId && lead.assignedAgentId !== user.id) {
    throw new Error("You are not assigned to this lead.");
  }

  const now = new Date();

  // Mark active/pending follow-up as completed with outcome
  if (input.followUpId) {
    await prisma.followUp.update({
      where: { id: input.followUpId },
      data: {
        status: "COMPLETED",
        countermeasure: `Outcome: ${input.outcomeStatus} - ${input.outcomeNote.trim()}`,
      },
    });
  } else {
    await prisma.followUp.updateMany({
      where: { leadId: lead.id, status: "PENDING" },
      data: { status: "COMPLETED" },
    });
  }

  // Create next follow-up if scheduled
  let nextFollowUp = null;
  if (input.nextScheduledAt) {
    const nextDate = new Date(input.nextScheduledAt);
    if (!isNaN(nextDate.getTime())) {
      nextFollowUp = await prisma.followUp.create({
        data: {
          leadId: lead.id,
          agentId: user.id,
          scheduledAt: nextDate,
          note: `[${input.outcomeStatus}] ${input.outcomeNote.trim()}`,
          priority: input.priority || "MEDIUM",
          status: "PENDING",
        },
      });
    }
  }

  // Determine if lead status should update based on outcome
  let mappedLeadStatus: LeadStatus | null = null;
  const outcomeLower = input.outcomeStatus.toLowerCase();
  if (outcomeLower.includes("not respond") || outcomeLower.includes("no response")) {
    mappedLeadStatus = LeadStatus.NO_RESPONSE;
  } else if (outcomeLower.includes("interested")) {
    mappedLeadStatus = LeadStatus.INTERESTED;
  } else if (outcomeLower.includes("callback") || nextFollowUp) {
    mappedLeadStatus = LeadStatus.FOLLOWUP;
  }

  if (mappedLeadStatus && lead.status !== LeadStatus.CLOSED) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: mappedLeadStatus,
        statusChangedAt: now,
      },
    });
  }

  // Record in LeadStatusHistory
  try {
    await prisma.leadStatusHistory.create({
      data: {
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: mappedLeadStatus || lead.status,
        changedById: user.id,
        note: `Follow-up Outcome: ${input.outcomeStatus} — ${input.outcomeNote.trim()}`,
      },
    });
  } catch (e) {}

  // Explicitly log into AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "lead.followup_outcome",
        entityType: "Lead",
        entityId: lead.id,
        metadata: {
          leadId: lead.id,
          leadName: lead.name,
          outcomeStatus: input.outcomeStatus,
          outcomeNote: input.outcomeNote.trim(),
          nextScheduledAt: input.nextScheduledAt ? new Date(input.nextScheduledAt).toISOString() : null,
          agentName: user.name,
        },
      },
    });
  } catch (e) {}

  revalidatePath(`/dashboard/agent/chat/${lead.id}`);
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, nextFollowUp };
}

// ── Overdue Accountability: Complete Overdue Follow-Up with Reason & Countermeasure ──
export async function resolveOverdueFollowUp(input: {
  followUpId: string;
  overdueReason: string;
  countermeasure: string;
}) {
  const user = await getAuthUser();
  if (!user) throw new Error("Unauthorized");

  if (!input.overdueReason?.trim() || !input.countermeasure?.trim()) {
    throw new Error("Reason for delay and countermeasure are mandatory.");
  }

  const existing = await prisma.followUp.findUnique({
    where: { id: input.followUpId },
    include: { lead: { select: { id: true, name: true, phone: true } } },
  });

  if (!existing) throw new Error("Follow-up not found.");
  if (user.role === "AGENT" && existing.agentId !== user.id) {
    throw new Error("You can only resolve your own follow-up.");
  }

  const now = new Date();

  const updated = await prisma.followUp.update({
    where: { id: input.followUpId },
    data: {
      status: "COMPLETED",
      overdueReason: input.overdueReason.trim(),
      countermeasure: input.countermeasure.trim(),
    },
  });

  // Explicitly log in AuditLog for Admin Audit Trail
  try {
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "followup.overdue_resolved",
        entityType: "FollowUp",
        entityId: existing.id,
        metadata: {
          followUpId: existing.id,
          leadId: existing.leadId,
          leadName: existing.lead.name,
          overdueReason: input.overdueReason.trim(),
          countermeasure: input.countermeasure.trim(),
          scheduledAt: existing.scheduledAt.toISOString(),
          resolvedAt: now.toISOString(),
          agentName: user.name,
        },
      },
    });
  } catch (e) {}

  revalidatePath(`/dashboard/agent/chat/${existing.leadId}`);
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin");

  return { success: true, followUp: updated };
}

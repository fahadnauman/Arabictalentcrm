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

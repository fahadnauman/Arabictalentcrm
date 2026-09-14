"use server";

import { prisma }                   from "@/lib/prisma";
import { cookies }                  from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { LeadStatus, PaymentStatus } from "@prisma/client";
import { revalidatePath }           from "next/cache";

// ── Shared auth helper ────────────────────────────────────────────────────
async function getUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) throw new Error("Unauthorised");
  const user = await verifyToken(token);
  if (!user) throw new Error("Unauthorised");
  return user;
}

// ── Update status (non-CLOSED tags) ──────────────────────────────────────
/** Updates a lead's status — CLOSED path goes through closeDeal instead. */
export async function updateLeadStatus(leadId: string, newStatus: LeadStatus) {
  const user = await getUser();

  const filter =
    user.role === "ADMIN"
      ? { id: leadId }
      : { id: leadId, assignedAgentId: user.id };

  await prisma.lead.update({
    where: filter,
    data:  {
      status:          newStatus,
      statusChangedAt: new Date(),
      closedAt:        newStatus === LeadStatus.CLOSED ? new Date() : null,
    },
  });

  revalidatePath(`/dashboard/agent/chat/${leadId}`);
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath("/dashboard/agent");
}

// ── Close Deal (CLOSED + revenue capture) ────────────────────────────────
export interface CloseDealInput {
  courseType:    string;
  amountAED:     number;
  paymentStatus: PaymentStatus;
}

export async function closeDeal(leadId: string, data: CloseDealInput) {
  const user = await getUser();

  const filter =
    user.role === "ADMIN"
      ? { id: leadId }
      : { id: leadId, assignedAgentId: user.id };

  const now = new Date();

  await prisma.lead.update({
    where: filter,
    data:  {
      status:          LeadStatus.CLOSED,
      closedAt:        now,
      statusChangedAt: now,
      dealValueCents:  Math.round(data.amountAED * 100),
      dealCurrency:    "AED",
      courseType:      data.courseType.trim(),
      paymentStatus:   data.paymentStatus,
    },
  });

  // Revalidate agent home so revenue hero updates on next visit
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath(`/dashboard/agent/chat/${leadId}`);
}

// ── Update lead info (from the Lead Info Panel) ───────────────────────────
export interface LeadInfoInput {
  name?:       string;
  phone?:      string;
  company?:    string;
  profession?: string;
  country?:    string;
  notes?:      string;
  courseType?: string;
  amountPaid?: number; // conditional from portfolio
  status?:     string;
  paymentStatus?: string;
}

export async function updateLeadInfo(leadId: string, data: LeadInfoInput) {
  const user = await getUser();

  const filter =
    user.role === "ADMIN"
      ? { id: leadId }
      : { id: leadId, assignedAgentId: user.id };

  const updateData: any = {};
  if (data.name !== undefined)       updateData.name       = data.name.trim();
  if (data.phone !== undefined)      updateData.phone      = data.phone.trim();
  if (data.company !== undefined)    updateData.company    = data.company.trim() || null;
  if (data.profession !== undefined) updateData.profession = data.profession.trim() || null;
  if (data.country !== undefined)    updateData.country    = data.country.trim() || null;
  if (data.notes !== undefined)      updateData.notes      = data.notes.trim() || null;
  if (data.courseType !== undefined) updateData.courseType = data.courseType.trim() || null;
  
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.paymentStatus !== undefined) {
    updateData.paymentStatus = data.paymentStatus;
  }
  if (data.amountPaid !== undefined && data.amountPaid > 0) {
    updateData.dealValueCents = BigInt(Math.round(data.amountPaid * 100));
    updateData.status = "CLOSED";
    updateData.closedAt = new Date();
  }

  await prisma.lead.update({
    where: filter,
    data:  updateData,
  });

  revalidatePath(`/dashboard/agent/chat/${leadId}`);
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath(`/dashboard/portfolio/${leadId}`);
  revalidatePath("/dashboard/admin/leads");
}

// ── Lead Transfer System ──────────────────────────────────────────────────
export interface ActiveAgentItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  languageGroup: string;
}

/** Fetches all active agents for lead transfer selection. */
export async function getActiveAgents(): Promise<ActiveAgentItem[]> {
  const user = await getUser();
  if (!user) throw new Error("Unauthorised");

  return await prisma.user.findMany({
    where: {
      role: "AGENT",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      languageGroup: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Transfers a lead from the current agent to a target agent in Prisma. */
export async function transferLead(leadId: string, targetAgentId: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorised");

  if (!targetAgentId) {
    throw new Error("Target agent must be specified.");
  }

  // Verify target agent exists, has AGENT role, and is active
  const targetAgent = await prisma.user.findUnique({
    where: { id: targetAgentId },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      languageGroup: true,
    },
  });

  if (!targetAgent || targetAgent.role !== "AGENT" || !targetAgent.isActive) {
    throw new Error("The selected agent is not active or could not be found.");
  }

  // Verify user has permission to transfer this lead (ADMIN or current assigned agent)
  const filter =
    user.role === "ADMIN"
      ? { id: leadId }
      : { id: leadId, assignedAgentId: user.id };

  const lead = await prisma.lead.findFirst({
    where: filter,
    select: { id: true, name: true, assignedAgentId: true },
  });

  if (!lead) {
    throw new Error("Lead not found or you do not have permission to transfer this lead.");
  }

  // Update lead assignment in Prisma
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      assignedAgentId: targetAgent.id,
      statusChangedAt: new Date(),
    },
  });

  // Log to LeadAssignment history
  try {
    await prisma.leadAssignment.create({
      data: {
        leadId: lead.id,
        assignedToId: targetAgent.id,
        assignedBy: user.name ? `Manual transfer by ${user.name}` : "manual_transfer",
      },
    });
  } catch (logErr) {
    console.warn("Failed to record lead assignment log:", logErr);
  }

  revalidatePath(`/dashboard/agent/chat/${leadId}`);
  revalidatePath("/dashboard/agent/inbox");
  revalidatePath("/dashboard/agent");
  revalidatePath("/dashboard/admin/leads");
  revalidatePath(`/dashboard/portfolio/${leadId}`);

  return {
    success: true,
    leadId: lead.id,
    targetAgent: {
      id: targetAgent.id,
      name: targetAgent.name,
      languageGroup: targetAgent.languageGroup,
    },
  };
}

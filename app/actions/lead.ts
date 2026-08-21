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

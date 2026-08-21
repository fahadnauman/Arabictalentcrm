"use server";

import { prisma }                from "@/lib/prisma";
import { cookies }               from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getNextAgentInRotation, extractCampaignLanguage } from "@/lib/roundRobin";
import { LeadStatus }            from "@prisma/client";
import { redirect }              from "next/navigation";

export interface CreateLeadResult {
  success:    boolean;
  error?:     string;
  leadId?:    string;
  assignedTo?: string;
}

export async function createLeadAction(
  _prevState: CreateLeadResult | null,
  formData:   FormData
): Promise<CreateLeadResult> {
  // ── Auth ──────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return { success: false, error: "Not authenticated" };

  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" };
  }

  // ── Extract fields ────────────────────────────────────────────────────
  const name    = (formData.get("name")    as string)?.trim();
  const phone   = (formData.get("phone")   as string)?.trim();
  const company = (formData.get("company") as string)?.trim() || null;
  const notes   = (formData.get("notes")   as string)?.trim() || null;
  const campaign = (formData.get("campaign") as string)?.trim() ||
                   (formData.get("keyword")  as string)?.trim() ||
                   (formData.get("language") as string)?.trim() || null;
  const dealRaw = (formData.get("deal")    as string)?.trim();
  const dealCents = dealRaw ? Math.round(parseFloat(dealRaw) * 100) : null;

  // ── Validate ──────────────────────────────────────────────────────────
  if (!name) return { success: false, error: "Name is required" };
  if (!phone) return { success: false, error: "Phone number is required" };

  // Normalise to E.164
  const cleanPhone = phone.startsWith("+") ? phone : `+${phone.replace(/^0+/, "")}`;

  // ── Duplicate check ───────────────────────────────────────────────────
  const existing = await prisma.lead.findUnique({ where: { phone: cleanPhone } });
  if (existing) {
    return {
      success: false,
      error:   `A lead with phone ${cleanPhone} already exists.`,
      leadId:  existing.id,
    };
  }

  // ── Round-robin (filtered by campaign language) ───────────────────────
  const requiredLang = extractCampaignLanguage(campaign, notes);
  const assignment = await getNextAgentInRotation(requiredLang);
  const now = new Date();

  // ── Create ────────────────────────────────────────────────────────────
  const lead = await prisma.lead.create({
    data: {
      name,
      phone:           cleanPhone,
      company,
      notes,
      source:          "manual",
      status:          LeadStatus.NEW_LEAD,
      dealCurrency:    "AED",
      dealValueCents:  dealCents,
      assignedAgentId: assignment?.agentId ?? null,
      firstAssignedAt: assignment ? now : null,
      statusChangedAt: now,
    },
    select: { id: true },
  });

  // ── Audit log ─────────────────────────────────────────────────────────
  if (assignment) {
    await prisma.leadAssignment.create({
      data: {
        leadId:       lead.id,
        assignedToId: assignment.agentId,
        assignedBy:   "admin_manual",
      },
    });
  }

  // Redirect back to admin dashboard on success
  redirect("/dashboard/admin");
}

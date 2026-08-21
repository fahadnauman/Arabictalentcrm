/**
 * POST /api/leads
 *
 * Secure lead ingestion endpoint — accepts JSON and auto-assigns
 * via round-robin. Designed to be called by:
 *   • The admin manual-entry form (cookie auth)
 *   • n8n workflows or Twilio webhooks (Bearer API key auth)
 *
 * Request body:
 *   { name, phone, company?, notes?, source?, dealValueCents? }
 *
 * Returns 201 on success, 409 on duplicate phone, 400 on missing fields.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma }                    from "@/lib/prisma";
import { getNextAgentInRotation, extractCampaignLanguage } from "@/lib/roundRobin";
import { verifyToken, COOKIE_NAME }  from "@/lib/auth";
import { LeadStatus }                from "@prisma/client";

// ── Auth helper (cookie-only — internal use) ──────────────────────────────
async function isAuthorised(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const user = await verifyToken(token);
  return user?.role === "ADMIN";
}

// ── POST handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await isAuthorised(req))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name    = (body.name    as string | undefined)?.trim();
  const phone   = (body.phone   as string | undefined)?.trim();
  const company = (body.company as string | undefined)?.trim() || null;
  const notes   = (body.notes   as string | undefined)?.trim() || null;
  const source  = (body.source  as string | undefined)?.trim() || "manual";
  const campaign = (body.campaign as string | undefined)?.trim() ||
                   (body.keyword  as string | undefined)?.trim() ||
                   (body.language as string | undefined)?.trim() || null;
  const dealCents = body.dealValueCents != null
    ? Number(body.dealValueCents)
    : null;

  // ── Validate ──────────────────────────────────────────────────────────
  if (!name || !phone) {
    return NextResponse.json(
      { error: "name and phone are required" },
      { status: 400 }
    );
  }

  // Basic E.164 sanity check (allows +971… or 971… or plain 05…)
  const cleanPhone = phone.startsWith("+") ? phone : `+${phone.replace(/^0+/, "")}`;

  // ── Duplicate guard ───────────────────────────────────────────────────
  const existing = await prisma.lead.findUnique({ where: { phone: cleanPhone } });
  if (existing) {
    return NextResponse.json(
      { error: `Lead with phone ${cleanPhone} already exists`, leadId: existing.id },
      { status: 409 }
    );
  }

  // ── Round-robin assignment (filtered by campaign language) ────────────
  const requiredLang = extractCampaignLanguage(campaign, notes, source, name);
  const assignment = await getNextAgentInRotation(requiredLang);
  const now = new Date();

  // ── Create lead ───────────────────────────────────────────────────────
  const lead = await prisma.lead.create({
    data: {
      name,
      phone:           cleanPhone,
      company,
      notes,
      source,
      status:          LeadStatus.NEW_LEAD,
      dealCurrency:    "AED",
      dealValueCents:  dealCents,
      assignedAgentId: assignment?.agentId ?? null,
      firstAssignedAt: assignment ? now : null,
      statusChangedAt: now,
    },
    select: {
      id:       true,
      name:     true,
      phone:    true,
      company:  true,
      source:   true,
      status:   true,
      createdAt: true,
      assignedAgent: { select: { name: true } },
    },
  });

  // ── Log assignment ────────────────────────────────────────────────────
  if (assignment) {
    await prisma.leadAssignment.create({
      data: {
        leadId:      lead.id,
        assignedToId: assignment.agentId,
        assignedBy:  "round_robin",
      },
    });
  }

  return NextResponse.json(
    {
      success:    true,
      assignedTo: lead.assignedAgent?.name ?? "Unassigned",
      lead: {
        id:        lead.id,
        name:      lead.name,
        phone:     lead.phone,
        company:   lead.company,
        status:    lead.status,
        createdAt: lead.createdAt,
      },
    },
    { status: 201 }
  );
}

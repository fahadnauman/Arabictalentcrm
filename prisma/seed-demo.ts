/**
 * prisma/seed-demo.ts
 * Seeds 15 realistic dummy leads distributed across agents
 * with a spread of all five pipeline statuses.
 * Run with: npm run seed:demo
 */

import { PrismaClient, LeadStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ── Dummy lead data ────────────────────────────────────────────────────────

const LEADS: {
  name: string;
  phone: string;
  company?: string;
  status: LeadStatus;
  dealValueCents?: number;
  daysAgo: number;
}[] = [
  // ── CLOSED (3) — real revenue ──────────────────────────────────────────
  { name: "Ahmed Al-Rashid",   phone: "+971501234001", company: "Gulf Tech LLC",    status: "CLOSED", dealValueCents: 250000, daysAgo: 2  },
  { name: "Sara Al-Mansoori",  phone: "+971501234002", company: "Dubai Media Inc.", status: "CLOSED", dealValueCents: 180000, daysAgo: 5  },
  { name: "Khalid Bin Hamad",  phone: "+971501234003", company: "Al Noor Trading",  status: "CLOSED", dealValueCents: 320000, daysAgo: 8  },

  // ── THINKING (4) — active conversations ───────────────────────────────
  { name: "Fatima Al-Zaabi",   phone: "+971501234004", company: "ZEN Solutions",    status: "THINKING", daysAgo: 1 },
  { name: "Omar Bin Zayed",    phone: "+971501234005", company: "Phoenix Group",    status: "THINKING", daysAgo: 3 },
  { name: "Layla Al-Hashimi",  phone: "+971501234006",                              status: "THINKING", daysAgo: 4 },
  { name: "Yousef Al-Muhairi", phone: "+971501234007", company: "Apex Ventures",   status: "THINKING", daysAgo: 6 },

  // ── NO_RESPONSE (3) — awaiting reply ──────────────────────────────────
  { name: "Hessa Al-Falasi",   phone: "+971501234008",                              status: "NO_RESPONSE", daysAgo: 7  },
  { name: "Rashed Al-Ketbi",   phone: "+971501234009", company: "Horizon Corp",    status: "NO_RESPONSE", daysAgo: 10 },
  { name: "Maryam Bin Sulayt", phone: "+971501234010",                              status: "NO_RESPONSE", daysAgo: 12 },

  // ── NEW_LEAD (3) — fresh, uncontacted ─────────────────────────────────
  { name: "Hamdan Al-Shamsi",  phone: "+971501234011", company: "Blue Wave Tech",  status: "NEW_LEAD", daysAgo: 0 },
  { name: "Noora Al-Blooshi",  phone: "+971501234012",                              status: "NEW_LEAD", daysAgo: 1 },
  { name: "Sultan Al-Mazrouei",phone: "+971501234013", company: "Summit Trading",  status: "NEW_LEAD", daysAgo: 1 },

  // ── NOT_INTERESTED (2) — declined ─────────────────────────────────────
  { name: "Aisha Al-Nuaimi",   phone: "+971501234014",                              status: "NOT_INTERESTED", daysAgo: 9  },
  { name: "Saeed Al-Marri",    phone: "+971501234015", company: "Desert Brands",   status: "NOT_INTERESTED", daysAgo: 14 },
];

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Seeding demo leads...\n");

  // Fetch existing agents to assign leads to
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", isActive: true },
    select: { id: true, name: true },
  });

  if (agents.length === 0) {
    throw new Error("No active agents found. Run `npm run seed` first.");
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < LEADS.length; i++) {
    const data = LEADS[i];

    // Assign leads round-robin across available agents
    const agent = agents[i % agents.length];

    const existing = await prisma.lead.findUnique({ where: { phone: data.phone } });
    if (existing) {
      console.log(`  ⏭  Skipped  (exists): ${data.name}`);
      skipped++;
      continue;
    }

    const createdAt = daysAgo(data.daysAgo);

    await prisma.lead.create({
      data: {
        name:            data.name,
        phone:           data.phone,
        company:         data.company ?? null,
        status:          data.status,
        dealCurrency:    "AED",
        dealValueCents:  data.dealValueCents ?? null,
        source:          "whatsapp",
        assignedAgentId: agent.id,
        firstAssignedAt: createdAt,
        closedAt:        data.status === "CLOSED" ? createdAt : null,
        statusChangedAt: createdAt,
        createdAt,
        updatedAt:       createdAt,
      },
    });

    console.log(`  ✅  Created: ${data.name.padEnd(22)} [${data.status}] → ${agent.name}`);
    created++;
  }

  console.log(`\n📊  Done — ${created} leads created, ${skipped} skipped.\n`);

  // ── Status summary ──────────────────────────────────────────────────────
  const counts = await prisma.lead.groupBy({
    by: ["status"],
    _count: { status: true },
    orderBy: { _count: { status: "desc" } },
  });

  console.log("  Current lead breakdown:");
  for (const row of counts) {
    console.log(`    ${row.status.padEnd(16)} ${row._count.status}`);
  }
  console.log();
}

main()
  .catch((err) => { console.error("❌  Seed failed:", err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });

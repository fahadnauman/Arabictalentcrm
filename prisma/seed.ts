import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log("🌱  Seeding Nauman Labs CRM database...\n");

  const SALT_ROUNDS = 12;

  // ── 1. Admin user ───────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@NaumanLabs1", SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { email: "admin@arabictalent.com" },
    update: {},
    create: {
      email: "admin@arabictalent.com",
      name: "Admin",
      role: Role.ADMIN,
      passwordHash: adminPassword,
      isActive: true,
    },
  });

  console.log(`✅  Admin created   → ${admin.email}  (role: ${admin.role})`);

  // ── 2. Sales Agent user ─────────────────────────────────────────────────────
  const agentPassword = await bcrypt.hash("Agent@NaumanLabs1", SALT_ROUNDS);

  const agent = await prisma.user.upsert({
    where: { email: "agent1@arabictalent.com" },
    update: { languageGroup: "ENGLISH" },
    create: {
      email: "agent1@arabictalent.com",
      name: "Agent One",
      role: Role.AGENT,
      passwordHash: agentPassword,
      isActive: true,
      languageGroup: "ENGLISH",
    },
  });

  console.log(`✅  Agent created   → ${agent.email}  (role: ${agent.role})`);

  // ── 3. Add the agent to the Round-Robin queue ────────────────────────────────
  await prisma.roundRobinQueue.upsert({
    where: { agentId: agent.id },
    update: {},
    create: {
      agentId: agent.id,
      position: 1,
      isActive: true,
    },
  });

  console.log(`✅  RoundRobinQueue slot created for ${agent.email}\n`);
  console.log("🎉  Seed complete.");
}

main()
  .catch((err) => {
    console.error("❌  Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

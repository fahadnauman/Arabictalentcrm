import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ─── Prisma Singleton with Connection Pool Caching ───────────────────────────
// In serverless production environments (Vercel) and development hot-reloading,
// caching the PrismaClient and pg.Pool on `globalThis` guarantees that instances
// are reused across warm lambda invocations. This prevents exhausting database
// connection limits during high-frequency auto-polling.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createClient(): { prisma: PrismaClient; pool: Pool } {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10, // Capped to prevent pool exhaustion in serverless environments
    idleTimeoutMillis: 30000, // Reclaim idle connection slots after 30s
    connectionTimeoutMillis: 5000, // Fast failure timeout if DB is unreachable
  });

  const adapter = new PrismaPg(pool);
  // Cast needed because Prisma v7 adapter types are still evolving
  const client = new PrismaClient({ adapter } as any);

  return { prisma: client, pool };
}

if (!globalForPrisma.prisma) {
  const { prisma: client, pool } = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.pgPool = pool;
}

export const prisma: PrismaClient = globalForPrisma.prisma;

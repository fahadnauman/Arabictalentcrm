/**
 * lib/roundRobin.ts
 *
 * Least-recently-assigned round-robin engine.
 *
 * Algorithm:
 *   1. Query RoundRobinQueue for all ACTIVE agents.
 *   2. Pick the one whose lastAssignedAt is oldest
 *      (tie-break by position ASC).
 *   3. Atomically update that slot's lastAssignedAt = now().
 *   4. Return the agent so the caller can stamp the lead.
 *
 * The entire pick + update runs inside a Prisma transaction
 * so concurrent lead arrivals cannot assign the same agent twice.
 */

import { prisma } from "@/lib/prisma";

export interface RRAssignment {
  agentId:   string;
  agentName: string;
  languageGroup?: string;
}

/**
 * Extracts the required language pool ("ENGLISH" or "MALAYALAM") from any
 * combination of campaign keywords, notes, message bodies, or sources.
 */
export function extractCampaignLanguage(...texts: (string | null | undefined)[]): string {
  const combined = texts.filter(Boolean).join(" ").toLowerCase();

  // 1. Check for Malayalam / Kerala indicators
  if (
    combined.includes("malayalam") ||
    combined.includes("kerala") ||
    combined.includes("mallu") ||
    combined.includes("ml") ||
    combined.includes("kl")
  ) {
    return "MALAYALAM";
  }

  // 2. Check for English / GCC indicators
  if (
    combined.includes("gcc") ||
    combined.includes("english") ||
    combined.includes("en") ||
    combined.includes("global") ||
    combined.includes("uk") ||
    combined.includes("us")
  ) {
    return "ENGLISH";
  }

  // Default fallback if no specific keyword matched
  return "ENGLISH";
}

export async function getNextAgentInRotation(preferredLanguage?: string): Promise<RRAssignment | null> {
  const targetLanguage = (preferredLanguage || "ENGLISH").toUpperCase();

  return prisma.$transaction(async (tx) => {
    // 1 — Find the next eligible agent exclusively within the target language pool
    const slot = await tx.roundRobinQueue.findFirst({
      where:   { 
        isActive: true,
        agent: {
          isActive: true,
          role: "AGENT",
          languageGroup: targetLanguage,
        },
      },
      orderBy: [
        { lastAssignedAt: "asc" }, // least-recently-assigned goes first
        { position:       "asc" }, // tie-break by explicit queue order
      ],
      include: {
        agent: { select: { id: true, name: true, isActive: true, languageGroup: true } },
      },
    });

    // No active agents configured in this language pool (zero cross-assignment guarantee)
    if (!slot || !slot.agent.isActive) return null;

    // 2 — Advance this agent's cursor so the next call picks someone else
    await tx.roundRobinQueue.update({
      where: { id: slot.id },
      data:  { lastAssignedAt: new Date() },
    });

    return { 
      agentId: slot.agent.id, 
      agentName: slot.agent.name,
      languageGroup: slot.agent.languageGroup 
    };
  });
}

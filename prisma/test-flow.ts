import { prisma } from "../lib/prisma";
import { getNextAgentInRotation } from "../lib/roundRobin";

async function main() {
  console.log("Testing Round Robin Logic...");
  
  // Try assigning 5 leads to see the rotation
  for (let i = 1; i <= 5; i++) {
    const assignment = await getNextAgentInRotation();
    console.log(`Lead ${i} assigned to:`, assignment?.agentName || "No agent available");
  }

  // Check the queue state
  const queue = await prisma.roundRobinQueue.findMany({
    include: { agent: { select: { name: true, role: true } } },
    orderBy: { lastAssignedAt: "asc" }
  });

  console.log("\nCurrent Queue State:");
  queue.forEach(q => {
    console.log(`- ${q.agent.name} (Role: ${q.agent.role}): Last Assigned ${q.lastAssignedAt}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

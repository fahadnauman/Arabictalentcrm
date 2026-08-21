import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getNextAgentInRotation } from "@/lib/roundRobin";

export async function GET(req: Request) {
  // Optional: Verify cron secret if provided in environment
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    // 1. Query for all active leads that have an assigned agent
    const activeLeads = await prisma.lead.findMany({
      where: {
        status: { notIn: ["CLOSED", "NOT_INTERESTED"] },
        assignedAgentId: { not: null },
      },
      include: {
        assignedAgent: { select: { id: true, name: true, languageGroup: true } },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1
        }
      }
    });

    let reassignedCount = 0;

    for (const lead of activeLeads) {
      if (!lead.assignedAgent || lead.messages.length === 0) continue;

      const lastMsg = lead.messages[0];

      // 2. Check if the latest message is from the customer and > 20 mins old
      if (lastMsg.direction === "INBOUND" && lastMsg.sentAt < twentyMinsAgo) {
        
        // 3. Find the next eligible agent in the same language pool
        const nextAssignment = await getNextAgentInRotation(lead.assignedAgent.languageGroup);

        if (nextAssignment && nextAssignment.agentId !== lead.assignedAgentId) {
          
          // 4. Update the lead's assigned agent
          await prisma.lead.update({
            where: { id: lead.id },
            data: { assignedAgentId: nextAssignment.agentId }
          });

          // 5. Inject an internal-only system message resetting the timeout clock
          await prisma.message.create({
            data: {
              leadId: lead.id,
              body: `System: Agent ${lead.assignedAgent.name} did not respond within 20 minutes. Lead automatically reassigned to ${nextAssignment.agentName}.`,
              direction: "OUTBOUND", // Classified as outbound to stop the timeout loop
              status: "SENT",
              sentById: nextAssignment.agentId, // Attributed to the new agent to appear on their side
              rawPayload: { type: "system_note", internal: true }
            }
          });

          console.log(`[CRON] Reassigned lead ${lead.id} from ${lead.assignedAgent.name} to ${nextAssignment.agentName}`);
          reassignedCount++;
        }
      }
    }

    return NextResponse.json({ success: true, reassignedCount });
  } catch (error: any) {
    console.error("[CRON] Error during reassignment:", error);
    return new NextResponse(`Error: ${error.message}`, { status: 500 });
  }
}

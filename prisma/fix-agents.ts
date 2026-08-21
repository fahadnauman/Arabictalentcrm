import { prisma } from "../lib/prisma";

async function main() {
  console.log("Fixing agent names and round robin queues...");

  const updates = [
    { email: "agent1@arabictalent.com", newName: "Agent 2" },
    { email: "agent2@arabictalent.com", newName: "Agent 3" },
    { email: "agent3@arabictalent.com", newName: "Agent 4" },
  ];

  for (const update of updates) {
    const user = await prisma.user.findUnique({ where: { email: update.email } });
    
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: update.newName }
      });
      
      const rr = await prisma.roundRobinQueue.findUnique({ where: { agentId: user.id } });
      if (!rr) {
        await prisma.roundRobinQueue.create({
          data: {
            agentId: user.id,
            isActive: true,
            position: 0
          }
        });
        console.log(`Created RoundRobinQueue for ${update.newName}`);
      } else {
        await prisma.roundRobinQueue.update({
          where: { id: rr.id },
          data: { isActive: true }
        });
      }
      
      console.log(`Updated ${update.email} to ${update.newName}`);
    } else {
      console.log(`User ${update.email} not found.`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

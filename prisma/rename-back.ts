import { prisma } from "../lib/prisma";

async function main() {
  console.log("Renaming agents to agent1, agent2, agent3...");

  const updates = [
    { email: "agent1@arabictalent.com", newName: "agent1" },
    { email: "agent2@arabictalent.com", newName: "agent2" },
    { email: "agent3@arabictalent.com", newName: "agent3" },
  ];

  for (const update of updates) {
    const user = await prisma.user.findUnique({ where: { email: update.email } });
    
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: update.newName }
      });
      console.log(`Updated ${update.email} to ${update.newName}`);
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

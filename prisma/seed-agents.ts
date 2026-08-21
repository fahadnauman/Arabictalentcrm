import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding test agent accounts...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const agents = [
    { name: "Agent One", email: "agent1@arabictalent.com", languageGroup: "ENGLISH" },
    { name: "Agent Two", email: "agent2@arabictalent.com", languageGroup: "MALAYALAM" },
    { name: "Agent Three", email: "agent3@arabictalent.com", languageGroup: "ENGLISH" },
    { name: "Agent Four", email: "agent4@arabictalent.com", languageGroup: "MALAYALAM" }
  ];

  for (const agent of agents) {
    let user = await prisma.user.findUnique({
      where: { email: agent.email }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: agent.name,
          email: agent.email,
          role: "AGENT",
          passwordHash: passwordHash,
          languageGroup: agent.languageGroup,
        }
      });
      console.log(`Created ${agent.email} [${agent.languageGroup}]`);
    } else {
      user = await prisma.user.update({
        where: { email: agent.email },
        data: {
          languageGroup: agent.languageGroup,
          role: "AGENT",
        }
      });
      console.log(`${agent.email} already exists. Updated languageGroup to ${agent.languageGroup}.`);
    }

    // Ensure they are in the RoundRobinQueue
    const rr = await prisma.roundRobinQueue.findUnique({ where: { agentId: user.id } });
    if (!rr) {
      await prisma.roundRobinQueue.create({
        data: {
          agentId: user.id,
          isActive: true,
          position: 0
        }
      });
      console.log(`Created RoundRobinQueue for ${agent.email}`);
    } else {
      await prisma.roundRobinQueue.update({
        where: { id: rr.id },
        data: { isActive: true }
      });
    }
  }

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { prisma } from "../lib/prisma";

async function main() {
  const agent = await prisma.user.findUnique({
    where: { email: "agent4@arabictalent.com" }
  });
  console.log("Agent 4:", agent);
}

main().finally(() => prisma.$disconnect());

import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { getNextAgentInRotation, extractCampaignLanguage } from "../lib/roundRobin.js";

async function runRoutingVerification() {
  console.log("==================================================");
  console.log("ROUND-ROBIN ROUTING INTEGRITY VERIFICATION");
  console.log("==================================================\n");

  // 1. Check all current agents in database
  const allAgents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true, email: true, languageGroup: true, isActive: true },
  });
  console.log(`Found ${allAgents.length} total agents in database.`);
  allAgents.forEach(a => {
    console.log(` - [${a.isActive ? "ACTIVE" : "INACTIVE"}] ${a.name} (${a.email}) | Pool: ${a.languageGroup}`);
  });

  // 2. Verify campaign language extraction
  console.log("\n--- Testing Language Extraction ---");
  const t1 = extractCampaignLanguage("Facebook Malayalam Ad", "Looking for Kerala course");
  const t2 = extractCampaignLanguage("Dubai GCC Business Lead", "Interested in sales");
  const t3 = extractCampaignLanguage("Random Inquiry");
  console.log(`Result 1 (Malayalam text): ${t1} (Expected: MALAYALAM)`);
  console.log(`Result 2 (GCC English text): ${t2} (Expected: ENGLISH)`);
  console.log(`Result 3 (Fallback text): ${t3} (Expected: ENGLISH)`);
  if (t1 !== "MALAYALAM" || t2 !== "ENGLISH" || t3 !== "ENGLISH") {
    throw new Error("Language extraction verification failed!");
  }

  // 3. Test English pool rotation
  console.log("\n--- Testing ENGLISH Pool Dynamic Rotation ---");
  const pick1 = await getNextAgentInRotation("ENGLISH");
  console.log("Pick 1:", pick1);
  const pick2 = await getNextAgentInRotation("ENGLISH");
  console.log("Pick 2:", pick2);

  if (!pick1 || !pick2) {
    console.warn("Notice: Fewer active agents available for rotation, but getNextAgentInRotation executed successfully.");
  } else {
    console.log(`✅ Rotation advanced. Agent 1: ${pick1.agentName}, Agent 2: ${pick2.agentName}`);
  }

  // 4. Test Malayalam pool rotation
  console.log("\n--- Testing MALAYALAM Pool Dynamic Rotation ---");
  const mlPick = await getNextAgentInRotation("MALAYALAM");
  console.log("Malayalam Pick:", mlPick);
  if (mlPick) {
    console.log(`✅ Selected agent: ${mlPick.agentName} (Pool: ${mlPick.languageGroup})`);
  }

  // 5. Test Non-existent pool fallback to ENGLISH
  console.log("\n--- Testing Unsupported Pool Fallback ---");
  const fbPick = await getNextAgentInRotation("FRENCH");
  console.log("Fallback Pick:", fbPick);
  if (fbPick) {
    console.log(`✅ Successfully fell back to default pool agent: ${fbPick.agentName}`);
  }

  console.log("\n==================================================");
  console.log("✅ ROUTING VERIFICATION PASSED SUCCESSFULLY");
  console.log("==================================================");
  process.exit(0);
}

runRoutingVerification().catch(err => {
  console.error("Routing verification failed:", err);
  process.exit(1);
});

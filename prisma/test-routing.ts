import { getNextAgentInRotation, extractCampaignLanguage } from "../lib/roundRobin";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Testing Lead Assignment Routing ===");

  // 1. Simulate Malayalam keyword
  const text1 = "Hi, I am interested in the Malayalam campaign";
  const lang1 = extractCampaignLanguage(text1);
  console.log(`\nSimulating Lead 1 (Text: "${text1}")`);
  console.log(`Extracted Language: ${lang1}`);
  
  const assignment1 = await getNextAgentInRotation(lang1);
  if (assignment1) {
    console.log(`Assigned Agent: ${assignment1.agentName} (ID: ${assignment1.agentId})`);
    console.log(`Agent Language Group: ${assignment1.languageGroup}`);
  } else {
    console.log("No active agent found for this language pool.");
  }

  // 2. Simulate GCC/English keyword
  const text2 = "Hello, I am contacting you regarding the GCC properties";
  const lang2 = extractCampaignLanguage(text2);
  console.log(`\nSimulating Lead 2 (Text: "${text2}")`);
  console.log(`Extracted Language: ${lang2}`);

  const assignment2 = await getNextAgentInRotation(lang2);
  if (assignment2) {
    console.log(`Assigned Agent: ${assignment2.agentName} (ID: ${assignment2.agentId})`);
    console.log(`Agent Language Group: ${assignment2.languageGroup}`);
  } else {
    console.log("No active agent found for this language pool.");
  }

  // 3. Simulate another Malayalam keyword to ensure round-robin rotates if multiple agents exist
  const text3 = "malayalam speakers available?";
  const lang3 = extractCampaignLanguage(text3);
  console.log(`\nSimulating Lead 3 (Text: "${text3}")`);
  console.log(`Extracted Language: ${lang3}`);

  const assignment3 = await getNextAgentInRotation(lang3);
  if (assignment3) {
    console.log(`Assigned Agent: ${assignment3.agentName} (ID: ${assignment3.agentId})`);
    console.log(`Agent Language Group: ${assignment3.languageGroup}`);
  } else {
    console.log("No active agent found for this language pool.");
  }

  console.log("\n=== Test Complete ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

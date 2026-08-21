import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== Testing Twilio Webhook Endpoint ===");

  // Prepare a simulated Twilio payload
  const payload = new URLSearchParams({
    From: "whatsapp:+971509998888", // New lead
    Body: "Hi, I am interested in property. Malayalam speaker please.",
    MessageSid: `SM${Math.random().toString(36).substring(2, 15)}`, // Random ID
    ProfileName: "Test Webhook User",
    Campaign: "Malayalam"
  });

  console.log("Sending POST to http://localhost:3000/api/webhook/twilio...");
  
  const response = await fetch("http://localhost:3000/api/webhook/twilio", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });

  console.log(`Response Status: ${response.status}`);
  const responseText = await response.text();
  console.log(`Response Body: ${responseText}`);

  // Wait a moment for async DB operations if any (though it should be synchronous)
  await new Promise(resolve => setTimeout(resolve, 500));

  // Verify in the database
  const lead = await prisma.lead.findUnique({
    where: { phone: "+971509998888" },
    include: {
      assignedAgent: true,
      messages: true
    }
  });

  if (lead) {
    console.log("\n--- Verification Results ---");
    console.log(`Lead Created: ${lead.name} (${lead.phone})`);
    console.log(`Assigned To: ${lead.assignedAgent?.name} [${lead.assignedAgent?.languageGroup}]`);
    console.log(`Messages Saved: ${lead.messages.length}`);
    console.log(`Latest Message Body: "${lead.messages[0]?.body}"`);
  } else {
    console.error("\n❌ Lead was not found in the database!");
  }

  console.log("\n=== Test Complete ===");
}

main()
  .catch(console.error)
  .finally(async () => {
    // Cleanup the test lead so we can run this test again if needed
    try {
      await prisma.lead.delete({ where: { phone: "+971509998888" } });
      console.log("Test lead cleaned up.");
    } catch(e) {}
    await prisma.$disconnect();
  });

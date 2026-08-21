import { cookies }               from "next/headers";
import { redirect }              from "next/navigation";
import Link                      from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma }                from "@/lib/prisma";
import LeadForm                  from "./LeadForm";

export default async function NewLeadPage() {
  // Auth guard
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  // Show current queue state so admin can see who's next
  const queue = await prisma.roundRobinQueue.findMany({
    where:   { isActive: true },
    orderBy: [{ lastAssignedAt: "asc" }, { position: "asc" }],
    select: {
      position:       true,
      lastAssignedAt: true,
      agent: { select: { name: true, email: true } },
    },
  });

  const nextAgent = queue[0]?.agent.name ?? "No active agents";

  return (
    <main style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.15) 0%, transparent 60%), #07080f",
      fontFamily: "'Inter', system-ui, sans-serif",
      color: "#f0f0ff",
      padding: "2rem 1.5rem 4rem",
    }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#8b8aa8" }}>
          <Link href="/dashboard/admin" style={{ color: "#8b8aa8", textDecoration: "none" }}>
            ← Admin Dashboard
          </Link>
          <span>/</span>
          <span style={{ color: "#f0f0ff" }}>New Lead</span>
        </div>

        {/* Page title */}
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.35rem" }}>
          Add New Lead
        </h1>
        <p style={{ fontSize: "0.85rem", color: "#8b8aa8", marginBottom: "1.75rem" }}>
          Lead will be auto-assigned via round-robin to the next available agent.
        </p>

        {/* Queue preview */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px", padding: "1rem 1.25rem",
          marginBottom: "1.75rem",
        }}>
          <p style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#4e4d6a", marginBottom: "0.75rem" }}>
            Round-Robin Queue
          </p>

          {queue.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#f87171" }}>
              ⚠ No active agents in the queue. Add agents first.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {queue.map((slot, i) => (
                <div key={slot.agent.email} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.5rem 0.75rem", borderRadius: "8px",
                  background: i === 0 ? "rgba(32,201,151,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${i === 0 ? "rgba(32,201,151,0.25)" : "rgba(255,255,255,0.05)"}`,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.65rem", fontWeight: 700,
                    background: i === 0 ? "rgba(32,201,151,0.2)" : "rgba(255,255,255,0.06)",
                    color: i === 0 ? "#20C997" : "#8b8aa8",
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: i === 0 ? "#20C997" : "#f0f0ff" }}>
                      {slot.agent.name}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "#4e4d6a", marginLeft: "0.5rem" }}>
                      {slot.agent.email}
                    </span>
                  </div>
                  {i === 0 && (
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700, padding: "0.15rem 0.5rem",
                      borderRadius: 999, background: "rgba(32,201,151,0.15)",
                      border: "1px solid rgba(32,201,151,0.3)", color: "#20C997",
                    }}>
                      NEXT ↗
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form card */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: "16px", padding: "1.75rem",
        }}>
          <LeadForm />
        </div>

        {/* API info */}
        <div style={{
          marginTop: "1.5rem", padding: "1rem 1.25rem", borderRadius: "12px",
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          fontSize: "0.78rem", color: "#4e4d6a",
        }}>
          <p style={{ fontWeight: 600, color: "#8b8aa8", marginBottom: "0.35rem" }}>
            🔗 REST API also available
          </p>
          <code style={{ fontSize: "0.72rem", color: "#6b6a88", display: "block" }}>
            POST /api/leads
          </code>
          <code style={{ fontSize: "0.72rem", color: "#6b6a88", display: "block", marginTop: "0.2rem" }}>
            Authorization: Bearer {"$"}{"{API_SECRET_KEY}"}
          </code>
          <p style={{ marginTop: "0.5rem", lineHeight: 1.5 }}>
            Use this endpoint to ingest leads from n8n, Twilio webhooks, or any external source.
          </p>
        </div>

      </div>
    </main>
  );
}

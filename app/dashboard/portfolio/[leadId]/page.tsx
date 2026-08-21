import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PortfolioForm from "./PortfolioForm";
import styles from "../../agent/agent.module.css";

export default async function LeadPortfolioPage({ params }: { params: Promise<{ leadId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user) redirect("/login");

  const { leadId } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  });

  if (!lead) {
    return <div style={{ padding: "2rem", color: "white" }}>Lead not found.</div>;
  }

  // Security: AGENT can only view their own leads. ADMIN can view all.
  if (user.role === "AGENT" && lead.assignedAgentId !== user.id) {
    return <div style={{ padding: "2rem", color: "white" }}>Unauthorized.</div>;
  }

  // Determine where the "Back" button should go
  const backLink = user.role === "ADMIN" ? "/dashboard/admin/leads" : "/dashboard/agent/portfolio";

  return (
    <div className={styles.shell} style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar} style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Link href={backLink} className={styles.backBtn} aria-label="Back">←</Link>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>
            {user.role === "ADMIN" ? "Master Leads" : "Portfolio"}
          </span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.agentBadge}>◈ {user.name}</span>
        </div>
      </header>

      <div className={styles.body} style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem", display: "flex", justifyContent: "center" }}>
        
        <div style={{ 
          width: "100%", maxWidth: "800px", marginTop: "2rem",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "2.5rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Aesthetic Glow */}
          <div style={{ position: "absolute", top: "-20%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(ellipse at center, rgba(32,201,151,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />

          <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#f1f0ff", marginBottom: "0.25rem", marginTop: 0 }}>
            Lead Info Portfolio
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#8b8aa8", marginBottom: "2.5rem", marginTop: 0 }}>
            Manage the full details, dynamic states, and revenue generation for {lead.name}.
          </p>

          <PortfolioForm 
            lead={{
              ...lead,
              dealValueCents: lead.dealValueCents ? BigInt(lead.dealValueCents) : null
            }} 
            userRole={user.role} 
          />
        </div>

      </div>
    </div>
  );
}

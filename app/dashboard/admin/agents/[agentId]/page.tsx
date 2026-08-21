import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAgentAnalytics } from "@/lib/queries/agent";
import styles from "../../admin.module.css";
import AgentStatusToggle from "./AgentStatusToggle";

const STATUS_META: Record<string, { label: string; pill: string }> = {
  NEW_LEAD:       { label: "New Lead",       pill: styles.pillNew  },
  THINKING:       { label: "Thinking",       pill: styles.pillThin },
  INTERESTED:     { label: "Interested",     pill: styles.pillIntr },
  WAITING_FOR_PAYMENT: { label: "Awaiting Pay", pill: styles.pillThin },
  NO_RESPONSE:    { label: "No Response",    pill: styles.pillNone },
  NOT_INTERESTED: { label: "Not Interested", pill: styles.pillNint },
  CLOSED:         { label: "Closed",         pill: styles.pillClos },
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export default async function AgentPortfolioPage({ params }: { params: Promise<{ agentId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  const { agentId } = await params;

  // Fetch agent details and all assigned leads
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    include: {
      assignedLeads: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!agent || agent.role !== "AGENT") {
    return <div style={{ padding: "2rem", color: "white" }}>Agent not found.</div>;
  }

  // Calculate Metrics
  const totalLeads = agent.assignedLeads.length;
  let closedDeals = 0;
  let revenueCents = BigInt(0);

  for (const lead of agent.assignedLeads) {
    if (lead.status === "CLOSED") {
      closedDeals++;
      if (lead.dealValueCents) revenueCents += BigInt(lead.dealValueCents);
    }
  }

  const winRate = totalLeads > 0 ? Math.round((closedDeals / totalLeads) * 100) : 0;
  
  const analytics = await getAgentAnalytics(agentId);

  return (
    <div className={styles.page}>
      {/* ── Top navigation bar ─────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Link href="/dashboard/admin/agents" className={styles.backBtn} aria-label="Back">←</Link>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>Agents Directory</span>
        </div>
        
        {/* Navigation Links */}
        <nav style={{ flex: 1, marginLeft: "2rem", display: "flex", gap: "1.5rem" }}>
          <Link href="/dashboard/admin" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Dashboard</Link>
          <Link href="/dashboard/admin/leads" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Leads</Link>
          <Link href="/dashboard/admin/agents" style={{ color: "#20C997", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>Agents</Link>
        </nav>

        <div className={styles.topbarRight}>
          <span className={styles.adminBadge}>⬡ &nbsp;{user.name}</span>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className={styles.main}>
        
        {/* Agent Profile Header */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px", padding: "2rem", display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: "2rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {(() => {
              const neonColors = ["#ff00ff", "#00ffff", "#20C997", "#facc15", "#bf00ff"];
              const rawColor = neonColors[agent.id.charCodeAt(agent.id.length - 1) % neonColors.length];
              const avatarStyle = { 
                width: 80, height: 80, borderRadius: "50%", 
                background: "#0a0e1a",
                boxShadow: `0 0 20px ${rawColor}`,
                border: `3px solid ${rawColor}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: rawColor, fontWeight: 800, fontSize: "32px",
                flexShrink: 0,
                textShadow: `0 0 10px ${rawColor}`
              };
              return agent.avatarUrl ? (
                <img src={agent.avatarUrl} alt={agent.name} style={{ ...avatarStyle, objectFit: "cover" }} />
              ) : (
                <div style={avatarStyle}>{agent.name.charAt(0).toUpperCase()}</div>
              );
            })()}
            <div>
              <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#f1f0ff", fontWeight: 800 }}>{agent.name}</h1>
              <div style={{ color: "#8b8aa8", fontSize: "0.9rem", marginTop: "0.2rem" }}>{agent.email}</div>
            </div>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "1rem" }}>
            <AgentStatusToggle agentId={agent.id} initialStatus={agent.isActive} />
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className={styles.statsGrid}>
          <div className={`${styles.statCard} ${styles.statGreen}`}>
            <div className={styles.statValue}>AED {(Number(revenueCents) / 100).toLocaleString("en-AE")}</div>
            <div className={styles.statLabel}>Total Revenue Generated</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{totalLeads}</div>
            <div className={styles.statLabel}>Total Assigned Leads</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{closedDeals}</div>
            <div className={styles.statLabel}>Deals Closed</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{winRate}%</div>
            <div className={styles.statLabel}>Win Rate</div>
          </div>
          <div className={`${styles.statCard} ${styles.statPurple}`}>
            <div className={styles.statValue}>{analytics.workingHours.toFixed(1)}h</div>
            <div className={styles.statLabel}>Total Working Hours</div>
          </div>
          <div className={`${styles.statCard} ${styles.statBlue}`}>
            <div className={styles.statValue}>{Math.round(analytics.avgResponseMins)}m</div>
            <div className={styles.statLabel}>Avg Response Time</div>
          </div>
          <div className={`${styles.statCard} ${styles.statOrange}`}>
            <div className={styles.statValue}>{analytics.convDurationHours.toFixed(1)}h</div>
            <div className={styles.statLabel}>Active Conv. Duration</div>
          </div>
        </div>

        {/* Assigned Leads Table */}
        <h2 style={{ fontSize: "1.2rem", color: "#f1f0ff", marginTop: "2.5rem", marginBottom: "1rem" }}>Assigned Leads Portfolio</h2>
        <div className={styles.tablePanel}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lead Details</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th>Deal Value</th>
                  <th>Added On</th>
                </tr>
              </thead>
              <tbody>
                {agent.assignedLeads.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={5}>No leads assigned yet.</td>
                  </tr>
                ) : (
                  agent.assignedLeads.map((lead) => {
                    const meta = STATUS_META[lead.status] || STATUS_META.NEW_LEAD;
                    return (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/dashboard/portfolio/${lead.id}`} style={{ textDecoration: "none" }}>
                            <div className={styles.leadName} style={{ color: "#20C997", cursor: "pointer" }}>{lead.name}</div>
                          </Link>
                          {lead.profession && <div className={styles.leadPhone} style={{ fontSize: "0.7rem", marginTop: "2px" }}>💼 {lead.profession}</div>}
                          {lead.country && <div className={styles.leadPhone} style={{ fontSize: "0.7rem" }}>🌍 {lead.country}</div>}
                        </td>
                        <td>
                          <div className={styles.leadPhone}>{lead.phone}</div>
                          {lead.email && <div className={styles.leadPhone} style={{ fontSize: "0.7rem" }}>{lead.email}</div>}
                        </td>
                        <td>
                          <span className={`${styles.pill} ${meta.pill}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          {lead.dealValueCents ? (
                            <span style={{ color: "#20C997", fontWeight: 700 }}>
                              AED {(Number(lead.dealValueCents) / 100).toLocaleString("en-AE")}
                            </span>
                          ) : (
                            <span style={{ color: "#4e4d6a" }}>-</span>
                          )}
                        </td>
                        <td>{formatDate(lead.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

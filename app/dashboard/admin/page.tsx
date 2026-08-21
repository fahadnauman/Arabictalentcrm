import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getAdminStats } from "@/lib/queries/admin";
import styles from "./admin.module.css";

import AdminActions from "./AdminActions";

// ── SVG Icons ────────────────────────────────────────────────────────────
const IconUsers  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IconTarget = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IconCheck  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IconTrend  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
const IconCRM    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

// ── Status helpers ────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; chip: string; pill: string; dot: string }> = {
  NEW_LEAD:       { label: "New Lead",       chip: styles.sNew,  pill: styles.pillNew,  dot: "#60a5fa" },
  THINKING:       { label: "Thinking",       chip: styles.sThin, pill: styles.pillThin, dot: "#3b82f6" },
  INTERESTED:     { label: "Interested",     chip: styles.sIntr, pill: styles.pillIntr, dot: "#20C997" },
  NO_RESPONSE:    { label: "No Response",    chip: styles.sNone, pill: styles.pillNone, dot: "#9ca3af" },
  NOT_INTERESTED: { label: "Not Interested", chip: styles.sNint, pill: styles.pillNint, dot: "#f87171" },
  CLOSED:         { label: "Closed",         chip: styles.sClos, pill: styles.pillClos, dot: "#fbbf24" },
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── Page ──────────────────────────────────────────────────────────────────
export default async function AdminDashboard() {
  // Auth check
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  // Fetch live data
  const stats = await getAdminStats();

  const statCards = [
    { label: "Total Leads",   value: stats.totalLeads,   icon: <IconTarget />, accent: styles.accentPurple },
    { label: "Closed Deals",  value: stats.closedDeals,  icon: <IconCheck />,  accent: styles.accentGreen  },
    { label: "Active Agents", value: stats.activeAgents, icon: <IconUsers />,  accent: styles.accentBlue   },
    { label: "Win Rate",      value: `${stats.winRate}%`,icon: <IconTrend />,  accent: styles.accentGold   },
  ];

  const statusOrder: (keyof typeof stats.statusBreakdown)[] = [
    "NEW_LEAD", "THINKING", "NO_RESPONSE", "NOT_INTERESTED", "CLOSED",
  ];

  return (
    <div className={styles.page}>

      {/* ── Top navigation bar ─────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.logoWrap}>
          <Link href="/dashboard/admin" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src="/logo.png" alt="Arabic Talent" style={{ height: 50, width: "auto", objectFit: "contain" }} />
          </Link>
          <span className={styles.logoDot}>·</span>
          <span className={styles.logoSub}>CRM</span>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, marginLeft: "2rem", display: "flex", gap: "1.5rem" }}>
          <Link href="/dashboard/admin" style={{ color: "#20C997", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>Dashboard</Link>
          <Link href="/dashboard/admin/leads" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Leads</Link>
          <Link href="/dashboard/admin/agents" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Agents</Link>
        </nav>

        <div className={styles.topbarRight}>
          <span className={styles.adminBadge}>⬡ &nbsp;{user.name}</span>
          <form className={styles.logoutForm} action="/api/auth/logout" method="POST">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className={styles.main}>

        {/* Page header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
          <h1 className={styles.heading} style={{ marginBottom: 0 }}>Admin Dashboard</h1>
          <AdminActions />
        </div>
        <p className={styles.subheading}>Live overview of your sales pipeline · Arabic Talent CRM</p>

        {/* ── Stat cards ───────────────────────────────────────────── */}
        <div className={styles.statsGrid}>
          {statCards.map((s) => (
            <div key={s.label} className={`${styles.statCard} ${s.accent}`}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Status breakdown ─────────────────────────────────────── */}
        <p className={styles.sectionTitle}>Lead Pipeline</p>
        <div className={styles.statusPanel}>
          <div className={styles.statusGrid}>
            {statusOrder.map((key) => {
              const meta  = STATUS_META[key];
              const count = stats.statusBreakdown[key];
              return (
                <div key={key} className={`${styles.statusChip} ${meta.chip}`}>
                  <div className={styles.statusDot} style={{ background: meta.dot }} />
                  <span className={styles.statusCount}>{count}</span>
                  <span className={styles.statusName}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Revenue & Performance Section ──────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "3rem" }}>
          <h2 className={styles.sectionTitle}>Revenue & Leaderboard</h2>
        </div>

        <div style={{ 
          background: "linear-gradient(135deg, rgba(32,201,151,0.1), rgba(32,201,151,0.02))",
          border: "1px solid rgba(32,201,151,0.3)",
          borderRadius: "16px",
          padding: "2rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 32px rgba(32,201,151,0.15)",
          position: "relative",
          overflow: "hidden"
        }}>
          {/* Decorative glow */}
          <div style={{ position: "absolute", top: "-50%", left: "-10%", width: "120%", height: "200%", background: "radial-gradient(ellipse at center, rgba(32,201,151,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
          
          <div style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#20C997", marginBottom: "0.5rem", zIndex: 1 }}>
            Total Revenue Generated
          </div>
          <div style={{ fontSize: "3.5rem", fontWeight: 800, color: "#f1f0ff", letterSpacing: "-0.03em", zIndex: 1, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
            AED {(stats.totalRevenueCents / 100).toLocaleString("en-AE")}
          </div>
        </div>

        <div className={styles.tablePanel} style={{ marginBottom: "3rem" }}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Total Leads</th>
                  <th>Pipeline</th>
                  <th>Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                {stats.agentPerformance.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={4}>No agents found.</td>
                  </tr>
                ) : (
                  stats.agentPerformance.map((agent) => (
                    <tr key={agent.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={styles.leadName}>{agent.name}</span>
                          {agent.isActive ? (
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#20C997", boxShadow: "0 0 6px #20C997" }} title="Active"></span>
                          ) : (
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#4e4d6a" }} title="Inactive"></span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "#f1f0ff", fontWeight: 600 }}>{agent.totalLeads}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <span className={styles.pillClos} title="Closed">{agent.closed} W</span>
                          <span className={styles.pillThin} title="Pending">{agent.pending} P</span>
                          <span className={styles.pillNint} title="Lost">{agent.lost} L</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: "#20C997", fontWeight: 700, letterSpacing: "-0.02em" }}>
                          AED {(agent.revenueGeneratedCents / 100).toLocaleString("en-AE")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent leads table ───────────────────────────────────── */}
        <p className={styles.sectionTitle}>Recent Leads</p>
        <div className={styles.tablePanel}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Status</th>
                  <th>Assigned Agent</th>
                  <th>Date Added</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentLeads.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={4}>No leads yet. Run the demo seed to populate data.</td>
                  </tr>
                ) : (
                  stats.recentLeads.map((lead) => {
                    const meta = STATUS_META[lead.status] ?? STATUS_META["NEW_LEAD"];
                    return (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/dashboard/portfolio/${lead.id}`} style={{ textDecoration: "none" }}>
                            <div className={styles.tdPrimary} style={{ color: "#f0f0ff", fontWeight: 700, cursor: "pointer" }}>
                              {lead.name}
                            </div>
                          </Link>
                          <div className={styles.tdSecondary}>{lead.phone}</div>
                        </td>
                        <td>
                          <span className={`${styles.pill} ${meta.pill}`}>{meta.label}</span>
                        </td>
                        <td>{lead.agentName ?? <span style={{ color: "#4e4d6a" }}>Unassigned</span>}</td>
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

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer style={{
        textAlign: "center", padding: "2rem", marginTop: "2rem",
        fontSize: "0.75rem", color: "#4e4d6a", letterSpacing: "0.05em",
        borderTop: "1px solid rgba(255,255,255,0.05)"
      }}>
        Arabic Talent CRM &nbsp;—&nbsp; Powered by Nauman Labs
      </footer>
    </div>
  );
}

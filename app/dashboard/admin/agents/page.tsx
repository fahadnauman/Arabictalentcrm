import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "../admin.module.css";
import AdminActions from "../AdminActions";

export default async function AgentsDirectoryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  // Fetch all agents with their leads
  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    orderBy: { createdAt: "asc" },
    include: {
      assignedLeads: {
        select: { status: true, dealValueCents: true }
      }
    }
  });

  // Calculate metrics for each agent
  const agentList = agents.map(agent => {
    let closed = 0;
    let revenueCents = 0n;

    for (const lead of agent.assignedLeads) {
      if (lead.status === "CLOSED") {
        closed++;
        if (lead.dealValueCents) {
          revenueCents += BigInt(lead.dealValueCents);
        }
      }
    }

    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      avatarUrl: agent.avatarUrl,
      isActive: agent.isActive,
      languageGroup: agent.languageGroup,
      totalLeads: agent.assignedLeads.length,
      closedDeals: closed,
      revenueCents,
    };
  });

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
          <Link href="/dashboard/admin" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Dashboard</Link>
          <Link href="/dashboard/admin/leads" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Leads</Link>
          <Link href="/dashboard/admin/agents" style={{ color: "#20C997", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>Agents</Link>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
          <h1 className={styles.heading} style={{ marginBottom: 0 }}>Agents Directory</h1>
          <AdminActions />
        </div>
        <p className={styles.subheading}>Master list of all agents, active status, and aggregate performance</p>

        <div className={styles.tablePanel} style={{ marginTop: "2rem" }}>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Agent Name</th>
                  <th>Language</th>
                  <th>Status</th>
                  <th>Assigned Leads</th>
                  <th>Closed Deals</th>
                  <th>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {agentList.length === 0 ? (
                  <tr className={styles.emptyRow}>
                    <td colSpan={6}>No agents created yet.</td>
                  </tr>
                ) : (
                  agentList.map((agent) => (
                    <tr key={agent.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                          {(() => {
                            const neonColors = ["#ff00ff", "#00ffff", "#20C997", "#facc15", "#bf00ff"];
                            const rawColor = neonColors[agent.id.charCodeAt(agent.id.length - 1) % neonColors.length];
                            const avatarStyle = { 
                              width: 36, height: 36, borderRadius: "50%", 
                              background: "#0a0e1a",
                              boxShadow: `0 0 10px ${rawColor}`,
                              border: `2px solid ${rawColor}`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              color: rawColor, fontWeight: 800, fontSize: "16px",
                              flexShrink: 0,
                              textShadow: `0 0 5px ${rawColor}`
                            };
                            return agent.avatarUrl ? (
                              <img src={agent.avatarUrl} alt={agent.name} style={{ ...avatarStyle, objectFit: "cover" }} />
                            ) : (
                              <div style={avatarStyle}>{agent.name.charAt(0).toUpperCase()}</div>
                            );
                          })()}
                          <div>
                            <Link href={`/dashboard/admin/agents/${agent.id}`} style={{ textDecoration: "none" }}>
                              <div className={styles.tdPrimary} style={{ color: "#20C997", fontWeight: 700, cursor: "pointer", display: "inline-block" }}>
                                {agent.name}
                              </div>
                            </Link>
                            <div className={styles.tdSecondary} style={{ fontSize: "0.75rem", marginTop: "2px" }}>{agent.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          color: agent.languageGroup === "MALAYALAM" ? "#facc15" : "#00ffff", 
                          background: agent.languageGroup === "MALAYALAM" ? "rgba(250,204,21,0.1)" : "rgba(0,255,255,0.1)", 
                          padding: "0.2rem 0.6rem", 
                          borderRadius: "99px", 
                          fontSize: "0.7rem", 
                          fontWeight: 700, 
                          border: `1px solid ${agent.languageGroup === "MALAYALAM" ? "rgba(250,204,21,0.2)" : "rgba(0,255,255,0.2)"}` 
                        }}>
                          {agent.languageGroup}
                        </span>
                      </td>
                      <td>
                        {agent.isActive ? (
                          <span style={{ color: "#20C997", background: "rgba(32,201,151,0.1)", padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(32,201,151,0.2)" }}>● ACTIVE</span>
                        ) : (
                          <span style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", padding: "0.2rem 0.6rem", borderRadius: "99px", fontSize: "0.7rem", fontWeight: 700, border: "1px solid rgba(248,113,113,0.2)" }}>○ INACTIVE</span>
                        )}
                      </td>
                      <td><span style={{ color: "#f1f0ff", fontWeight: 600 }}>{agent.totalLeads}</span></td>
                      <td><span style={{ color: "#f1f0ff", fontWeight: 600 }}>{agent.closedDeals}</span></td>
                      <td>
                        {agent.revenueCents > 0n ? (
                          <span style={{ color: "#20C997", fontWeight: 700, letterSpacing: "-0.01em" }}>
                            AED {(Number(agent.revenueCents) / 100).toLocaleString("en-AE")}
                          </span>
                        ) : (
                          <span style={{ color: "#4e4d6a" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

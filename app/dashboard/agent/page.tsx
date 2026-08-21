import { cookies }               from "next/headers";
import { redirect }              from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getAgentStats }         from "@/lib/queries/agent";
import { getActiveSession, clockIn, clockOut } from "@/app/actions/session";
import AgentBottomNav            from "./BottomNav";
import styles from "./agent.module.css";

// ── CRM logo icon ──────────────────────────────────────────────────────────
const IconCRM = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ── Pipeline status metadata ───────────────────────────────────────────────
const PIPELINE_ITEMS = [
  { key: "THINKING",       label: "Thinking",        dot: "#fbbf24" },
  { key: "NEW_LEAD",       label: "New Lead",         dot: "#60a5fa" },
  { key: "NO_RESPONSE",    label: "No Response",      dot: "#9ca3af" },
  { key: "CLOSED",         label: "Closed",           dot: "#20C997" },
  { key: "NOT_INTERESTED", label: "Not Interested",   dot: "#f87171" },
];

function formatAED(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + "M";
  if (amount >= 1_000)     return (amount / 1_000).toFixed(1) + "K";
  return amount.toLocaleString("en-AE");
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function AgentHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") redirect("/login");

  const stats   = await getAgentStats(user.id);
  const activeSession = await getActiveSession(user.id);
  const isClockedIn = !!activeSession;

  const winRate = stats.totalLeads > 0
    ? Math.round((stats.closedLeads / stats.totalLeads) * 100)
    : 0;

  return (
    <div className={styles.shell}>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <img src="/logo.png" alt="Arabic Talent" style={{ height: 32, width: "auto", objectFit: "contain" }} />
        </div>
        <div className={styles.topbarRight} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <form action={async () => {
            "use server";
            if (isClockedIn) await clockOut();
            else await clockIn();
          }}>
            <button type="submit" style={{
              padding: "0.4rem 0.8rem", borderRadius: "20px", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
              background: isClockedIn ? "rgba(248,113,113,0.15)" : "rgba(32,201,151,0.15)",
              color: isClockedIn ? "#f87171" : "#20C997",
              border: `1px solid ${isClockedIn ? "rgba(248,113,113,0.4)" : "rgba(32,201,151,0.4)"}`
            }}>
              {isClockedIn ? "Clock Out" : "Clock In"}
            </button>
          </form>
          <span className={styles.agentBadge}>◈ {user.name}</span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={styles.logoutBtn}>Out</button>
          </form>
        </div>
      </header>

      <div className={styles.body}>

        {/* ── Revenue hero ──────────────────────────────────────── */}
        <div className={styles.heroBlock}>
          <div className={styles.heroLabel}>Sales Amount Generated</div>
          <div className={styles.heroAmount}>
            <span className={styles.heroCurrency}>AED</span>
            {formatAED(stats.revenueAED)}
          </div>
          <div className={styles.heroSub}>
            from {stats.closedLeads} closed deal{stats.closedLeads !== 1 ? "s" : ""}
          </div>
          {stats.revenueAED > 0 && (
            <div className={styles.heroBadge}>▲ Revenue is live</div>
          )}
        </div>

        {/* ── Quick stats ─────────────────────────────────────────── */}
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={`${styles.statVal} ${styles.purpleVal}`}>{stats.totalLeads}</div>
            <div className={styles.statLbl}>Total Leads Joined</div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statVal} ${styles.blueVal}`}>{winRate}%</div>
            <div className={styles.statLbl}>Win Rate</div>
          </div>
        </div>

        {/* ── Pipeline breakdown ──────────────────────────────────── */}
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>My Pipeline</span>
        </div>

        <div className={styles.pipeRow}>
          {PIPELINE_ITEMS.map(({ key, label, dot }) => {
            const count = stats.breakdown[key] ?? 0;
            if (count === 0) return null;
            return (
              <div key={key} className={styles.pipeItem}>
                <span className={styles.pipeDot} style={{ background: dot }} />
                <span className={styles.pipeName}>{label}</span>
                <span className={styles.pipeNum} style={{ color: dot }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Shared bottom nav (3 tabs) ──────────────────────────── */}
      <AgentBottomNav />
    </div>
  );
}

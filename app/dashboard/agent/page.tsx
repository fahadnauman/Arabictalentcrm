import { cookies }               from "next/headers";
import { redirect }              from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getAgentStats }         from "@/lib/queries/agent";
import { getAgentTodayAttendance } from "@/app/actions/attendance";
import { getAgentTasks }           from "@/app/actions/task";
import { getAgentFollowUps }       from "@/app/actions/followup";
import AttendanceControls          from "./AttendanceControls";
import AgentTaskPanel              from "./AgentTaskPanel";
import DailyBriefingModal          from "./DailyBriefingModal";
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

  const [stats, todayAttendance, tasks, followUps] = await Promise.all([
    getAgentStats(user.id),
    getAgentTodayAttendance(user.id),
    getAgentTasks(user.id),
    getAgentFollowUps(user.id),
  ]);

  const winRate = stats.totalLeads > 0
    ? Math.round((stats.closedLeads / stats.totalLeads) * 100)
    : 0;

  return (
    <div className={styles.shell}>
      <DailyBriefingModal
        agentId={user.id}
        agentName={user.name}
        tasks={tasks}
        followUps={followUps as any}
      />

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <img src="/logo.png" alt="Arabic Talent" style={{ height: 32, width: "auto", objectFit: "contain" }} />
        </div>
        <div className={styles.topbarRight} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <AttendanceControls
            initialAttendance={
              todayAttendance
                ? {
                    id: todayAttendance.id,
                    status: todayAttendance.status,
                    clockIn: todayAttendance.clockIn,
                    breakStart: todayAttendance.breakStart,
                  }
                : null
            }
          />
          <span className={styles.agentBadge}>◈ {user.name}</span>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={styles.logoutBtn}>Out</button>
          </form>
        </div>
      </header>

      <div className={styles.body}>

        {/* ── Revenue hero with distinct Partial Payments tracking ── */}
        <div className={styles.heroBlock} style={{ position: "relative", overflow: "hidden" }}>
          <div className={styles.heroLabel}>Total Revenue Collected</div>
          <div className={styles.heroAmount}>
            <span className={styles.heroCurrency}>AED</span>
            {formatAED(stats.revenueTracking.totalCashCollectedAED)}
          </div>
          <div className={styles.heroSub} style={{ display: "flex", gap: "0.8rem", justifyContent: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
            <span>Full: <strong style={{ color: "#20C997" }}>AED {formatAED(stats.revenueTracking.fullRevenueAED)}</strong> ({stats.revenueTracking.fullDealsCount})</span>
            <span>·</span>
            <span>Partial: <strong style={{ color: "#fbbf24" }}>AED {formatAED(stats.revenueTracking.partialCollectedAED)}</strong> ({stats.revenueTracking.partialDealsCount})</span>
          </div>

          {stats.revenueTracking.partialBalanceDueAED > 0 && (
            <div style={{
              marginTop: "0.75rem",
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "8px",
              padding: "0.35rem 0.75rem",
              fontSize: "0.75rem",
              color: "#fbbf24",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
            }}>
              <span>⏳</span>
              <span>Pending Balance Due: <strong>AED {formatAED(stats.revenueTracking.partialBalanceDueAED)}</strong></span>
            </div>
          )}

          {stats.revenueTracking.totalCashCollectedAED > 0 && (
            <div className={styles.heroBadge}>▲ Revenue is live</div>
          )}
        </div>

        {/* ── Quick Stats: Total Leads, Follow-Up Leads, New Leads, Win Rate ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginTop: "1rem",
        }}>
          {/* Total Leads with Dynamic Temperature Breakdown */}
          <div className={styles.statCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className={`${styles.statVal} ${styles.purpleVal}`}>{stats.totalLeads}</div>
              <div className={styles.statLbl}>Total Leads Joined</div>
            </div>
            <div style={{
              display: "flex",
              gap: "0.35rem",
              marginTop: "0.5rem",
              fontSize: "0.65rem",
              fontWeight: 700,
              flexWrap: "wrap",
            }}>
              <span style={{ color: "#f87171" }} title="Hot Leads">🔥 {stats.temperatureBreakdown.HOT}</span>
              <span style={{ color: "#fbbf24" }} title="Warm Leads">☀️ {stats.temperatureBreakdown.WARM}</span>
              <span style={{ color: "#38bdf8" }} title="Cold Leads">❄️ {stats.temperatureBreakdown.COLD}</span>
            </div>
          </div>

          {/* Follow-Up Leads */}
          <div className={styles.statCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className={styles.statVal} style={{ color: "#fb923c" }}>{stats.followUpLeadsCount}</div>
              <div className={styles.statLbl}>Follow-Up Leads</div>
            </div>
            <span style={{ fontSize: "0.68rem", color: "#8b8aa8", marginTop: "0.5rem" }}>
              Active scheduling
            </span>
          </div>

          {/* New Leads */}
          <div className={styles.statCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className={styles.statVal} style={{ color: "#60a5fa" }}>{stats.newLeadsCount}</div>
              <div className={styles.statLbl}>New Leads</div>
            </div>
            <span style={{ fontSize: "0.68rem", color: "#8b8aa8", marginTop: "0.5rem" }}>
              Fresh in pipeline
            </span>
          </div>

          {/* Win Rate */}
          <div className={styles.statCard} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div className={`${styles.statVal} ${styles.blueVal}`}>{winRate}%</div>
              <div className={styles.statLbl}>Win Rate</div>
            </div>
            <span style={{ fontSize: "0.68rem", color: "#8b8aa8", marginTop: "0.5rem" }}>
              {stats.closedLeads} closed deals
            </span>
          </div>
        </div>

        {/* ── Today's Overview Section ───────────────────────────── */}
        <div style={{
          background: "linear-gradient(180deg, #101626 0%, #0a0e1a 100%)",
          border: "1px solid rgba(32, 201, 151, 0.2)",
          borderRadius: "16px",
          padding: "1.1rem",
          marginTop: "1.25rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.85rem",
            paddingBottom: "0.6rem",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>⚡</span>
              <span style={{ color: "#f1f0ff", fontWeight: 800, fontSize: "0.95rem" }}>
                Today&apos;s Overview
              </span>
            </div>
            {/* Dynamic Today Temperature Breakdown */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255, 255, 255, 0.04)",
              padding: "0.2rem 0.55rem",
              borderRadius: "99px",
              fontSize: "0.68rem",
              fontWeight: 700,
            }}>
              <span style={{ color: "#8b8aa8", marginRight: "0.2rem" }}>Today:</span>
              <span style={{ color: "#f87171" }} title="Today's Hot Leads">🔥 {stats.todayOverview.temperatureBreakdown.HOT}</span>
              <span style={{ color: "#fbbf24" }} title="Today's Warm Leads">☀️ {stats.todayOverview.temperatureBreakdown.WARM}</span>
              <span style={{ color: "#38bdf8" }} title="Today's Cold Leads">❄️ {stats.todayOverview.temperatureBreakdown.COLD}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
            <div style={{
              background: "rgba(249, 115, 22, 0.08)",
              border: "1px solid rgba(249, 115, 22, 0.2)",
              borderRadius: "10px",
              padding: "0.75rem",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fb923c" }}>
                {stats.todayOverview.todayFollowUps}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#d1d5db", fontWeight: 600, marginTop: "0.15rem" }}>
                Today&apos;s Follow-Ups
              </div>
            </div>

            <div style={{
              background: "rgba(96, 165, 250, 0.08)",
              border: "1px solid rgba(96, 165, 250, 0.2)",
              borderRadius: "10px",
              padding: "0.75rem",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#60a5fa" }}>
                {stats.todayOverview.todayNewLeads}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#d1d5db", fontWeight: 600, marginTop: "0.15rem" }}>
                Today&apos;s New Leads
              </div>
            </div>

            <div style={{
              background: "rgba(32, 201, 151, 0.08)",
              border: "1px solid rgba(32, 201, 151, 0.2)",
              borderRadius: "10px",
              padding: "0.75rem",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#20C997" }}>
                {stats.todayOverview.todayClosedDeals}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#d1d5db", fontWeight: 600, marginTop: "0.15rem" }}>
                Today&apos;s Closed Deals
              </div>
            </div>
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

        {/* ── Directives & Task Assignment Panel ──────────────────── */}
        <AgentTaskPanel initialTasks={tasks} agentId={user.id} />
      </div>

      {/* ── Shared bottom nav (3 tabs) ──────────────────────────── */}
      <AgentBottomNav />
    </div>
  );
}

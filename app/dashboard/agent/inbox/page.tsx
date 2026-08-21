import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getAgentLeads, getAgentStats } from "@/lib/queries/agent";
import AgentBottomNav from "../BottomNav";
import InboxClient from "./InboxClient";
import styles from "../agent.module.css";


// ── Icons ──────────────────────────────────────────────────────────────────
const IconHome  = () => <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconInbox = () => <svg className={styles.navIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>;
const IconChevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

// ── Status metadata ────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; pill: string; dot: string; barColor: string }> = {
  NEW_LEAD:       { label: "New Lead",       pill: styles.pillNew,  dot: "#60a5fa", barColor: "#3b82f6" },
  THINKING:       { label: "Thinking",       pill: styles.pillThin, dot: "#3b82f6", barColor: "#3b82f6" },
  INTERESTED:     { label: "Interested",     pill: styles.pillIntr, dot: "#20C997", barColor: "#20C997" },
  FOLLOWUP:       { label: "Followup",       pill: styles.pillThin, dot: "#fb923c", barColor: "#f97316" },
  DEMO_ATTENDED:  { label: "Demo Attended",  pill: styles.pillIntr, dot: "#c084fc", barColor: "#a855f7" },
  NO_RESPONSE:    { label: "No Response",    pill: styles.pillNone, dot: "#9ca3af", barColor: "#6b7280" },
  NOT_INTERESTED: { label: "Not Interested", pill: styles.pillNint, dot: "#f87171", barColor: "#ef4444" },
  CLOSED:         { label: "Closed",         pill: styles.pillClos, dot: "#fbbf24", barColor: "#fbbf24" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)  return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60)     return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)      return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function AgentInboxPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const resolvedParams = await searchParams;
  const currentFilter = resolvedParams.filter || "ALL";
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") redirect("/login");

  const [leads, stats] = await Promise.all([
    getAgentLeads(user.id),
    getAgentStats(user.id),
  ]);

  const active  = leads.filter((l) => l.status !== "CLOSED" && l.status !== "NOT_INTERESTED").length;
  const closed  = stats.closedLeads;
  const pending = (stats.breakdown["THINKING"] ?? 0) + (stats.breakdown["NEW_LEAD"] ?? 0);

  return (
    <div className={styles.shell}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.topbarLogo}>
          <Link href="/dashboard/agent" className={styles.backBtn}>←</Link>
          <span className={styles.inboxTitle}>My Leads</span>
        </div>
        <span className={styles.sectionCount}>{leads.length} total</span>
      </header>

      <div className={styles.body}>
        <InboxClient initialLeads={leads} activeCount={active} />
      </div>
      {/* ── Bottom navigation ──────────────────────────────────────── */}
      <AgentBottomNav />
    </div>
  );
}

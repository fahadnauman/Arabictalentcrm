import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AgentBottomNav from "../BottomNav";
import styles from "../agent.module.css";
import PortfolioClientList from "./PortfolioClientList";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW_LEAD:       { label: "New Lead",        color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  THINKING:       { label: "Thinking",        color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
  NO_RESPONSE:    { label: "No Response",     color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  NOT_INTERESTED: { label: "Not Interested",  color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  CLOSED:         { label: "Closed ✓",        color: "#20C997", bg: "rgba(32,201,151,0.1)" },
};

export default async function PortfolioPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") redirect("/login");

  // Fetch all leads assigned to this agent
  const leads = await prisma.lead.findMany({
    where: { assignedAgentId: user.id },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <div className={styles.shell} style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar} style={{ flexShrink: 0 }}>
        <div className={styles.topbarLogo}>
          <img src="/logo.png" alt="Arabic Talent" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <span className={styles.logoTitle} style={{ marginLeft: "0.5rem" }}>Lead Sheets</span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.agentBadge}>◈ {user.name}</span>
        </div>
      </header>

      <div className={styles.body} style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
        <p style={{ fontSize: "0.85rem", color: "#8b8aa8", marginBottom: "1.5rem", marginTop: "-0.5rem" }}>
          Your active portfolio. Tap any lead's name to open their chat.
        </p>

        <PortfolioClientList initialLeads={leads} />
      </div>

      <AgentBottomNav />
    </div>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import styles from "../admin.module.css";
import AdminLeadsClient from "./AdminLeadsClient";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

const STATUS_META: Record<string, { label: string; pill: string }> = {
  NEW_LEAD:       { label: "New Lead",       pill: styles.pillNew  },
  THINKING:       { label: "Thinking",       pill: styles.pillThin },
  INTERESTED:     { label: "Interested",     pill: styles.pillIntr },
  NO_RESPONSE:    { label: "No Response",    pill: styles.pillNone },
  NOT_INTERESTED: { label: "Not Interested", pill: styles.pillNint },
  CLOSED:         { label: "Closed",         pill: styles.pillClos },
};

export default async function MasterLeadsView() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  // Fetch all leads for the master view
  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignedAgent: { select: { name: true } } }
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
          <Link href="/dashboard/admin/leads" style={{ color: "#20C997", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>Leads</Link>
          <Link href="/dashboard/admin/agents" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>Agents</Link>
        </nav>

        <div className={styles.topbarRight}>
          <Link href="/dashboard/admin" style={{ fontSize: "0.8rem", color: "#8b8aa8", textDecoration: "none", marginRight: "1rem" }}>
            ← Back to Dashboard
          </Link>
          <span className={styles.adminBadge}>⬡ &nbsp;{user.name}</span>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className={styles.main}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
          <h1 className={styles.heading} style={{ marginBottom: 0 }}>Master Leads Directory</h1>
          <a
            href="/dashboard/admin/leads/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 1.1rem", borderRadius: "10px", textDecoration: "none",
              background: "linear-gradient(135deg,#7c3aed,#9333ea)",
              color: "white", fontSize: "0.82rem", fontWeight: 700,
              boxShadow: "0 3px 12px rgba(124,58,237,0.4)",
              transition: "transform 0.15s",
            }}
          >
            + Add Lead
          </a>
        </div>
        <p className={styles.subheading}>Complete directory of all leads and their assigned agents</p>

        <AdminLeadsClient initialLeads={leads} />
      </main>
    </div>
  );
}

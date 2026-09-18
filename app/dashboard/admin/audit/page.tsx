import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getFullAuditTrail } from "@/app/actions/audit";
import styles from "../admin.module.css";
import AuditTrailView from "./AuditTrailView";

export default async function FullAuditTrailPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "ADMIN") redirect("/login");

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const filter = resolvedParams.filter || "ALL";

  const auditData = await getFullAuditTrail({
    page,
    pageSize: 15,
    filterType: filter,
  });

  return (
    <div className={styles.page}>
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <header className={styles.topbar}>
        <div className={styles.logoWrap}>
          <Link href="/dashboard/admin" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <img src="/logo.png" alt="Arabic Talent" style={{ height: 50, width: "auto", objectFit: "contain" }} />
          </Link>
          <span className={styles.logoDot}>·</span>
          <span className={styles.logoSub}>CRM</span>
        </div>

        <nav style={{ flex: 1, marginLeft: "2rem", display: "flex", gap: "1.5rem" }}>
          <Link href="/dashboard/admin" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
            Dashboard
          </Link>
          <Link href="/dashboard/admin/leads" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
            Leads
          </Link>
          <Link href="/dashboard/admin/agents" style={{ color: "#8b8aa8", textDecoration: "none", fontSize: "0.9rem", fontWeight: 600 }}>
            Agents
          </Link>
          <Link href="/dashboard/admin/audit" style={{ color: "#20C997", textDecoration: "none", fontSize: "0.9rem", fontWeight: 700 }}>
            Audit Trail
          </Link>
        </nav>

        <div className={styles.topbarRight}>
          <span className={styles.adminBadge}>⬡ &nbsp;{user.name}</span>
          <form className={styles.logoutForm} action="/api/auth/logout" method="POST">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className={styles.main}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
          <div>
            <h1 className={styles.heading} style={{ marginBottom: "0.2rem" }}>
              Full Enterprise Audit Trail
            </h1>
            <p className={styles.subheading}>
              Comprehensive historical records of lead distribution, agent intakes, manual reassignments, status transitions, and directives.
            </p>
          </div>
        </div>

        {/* Client Interactive Audit Trail View */}
        <AuditTrailView initialData={auditData} initialFilter={filter} initialPage={page} />
      </main>
    </div>
  );
}

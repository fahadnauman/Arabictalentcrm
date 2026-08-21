import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import AgentBottomNav from "../BottomNav";
import QuickMessages from "./QuickMessages";
import EditableLibrary from "./EditableLibrary";
import styles from "../agent.module.css";

// ── Icons ──────────────────────────────────────────────────────────────────
const IconPayment = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#20C997" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
const IconDoc     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;

const DEFAULT_GUIDELINES = [
  { id: "1", title: "Deposit Policy", content: "Minimum deposit for partial payment is AED 500." },
  { id: "2", title: "Bank Transfer", content: "ADCB Account 1234567890 (Arabic Talent LLC). Always ask for a payment screenshot." },
  { id: "3", title: "Refunds", content: "No refunds after the 2nd session." },
];

const DEFAULT_DOCS = [
  { id: "1", title: "KHDA License 2024", content: "https://example.com/license.pdf", meta: "PDF · 1.2 MB" },
  { id: "2", title: "Course Curriculum", content: "https://example.com/curriculum.pdf", meta: "PDF · 4.5 MB" },
];

export default async function VaultPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");

  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") redirect("/login");

  return (
    <div className={styles.shell} style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar} style={{ flexShrink: 0 }}>
        <div className={styles.topbarLogo}>
          <img src="/logo.png" alt="Arabic Talent" style={{ height: 32, width: "auto", objectFit: "contain" }} />
          <span className={styles.logoTitle} style={{ marginLeft: "0.5rem" }}>Data Log</span>
        </div>
        <div className={styles.topbarRight}>
          <span className={styles.agentBadge}>◈ {user.name}</span>
        </div>
      </header>

      <div className={styles.body} style={{ flex: 1, overflowY: "auto", paddingBottom: "6rem" }}>
        <p style={{ fontSize: "0.85rem", color: "#8b8aa8", marginBottom: "1.5rem", marginTop: "-0.5rem" }}>
          Your fast-access library. Everything here can be edited or customized to your workflow.
        </p>

        <EditableLibrary
          storageKey="arabictalent_vault_guidelines"
          title="Payment Guidelines"
          icon={<IconPayment />}
          defaultItems={DEFAULT_GUIDELINES}
        />

        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#4e4d6a", marginBottom: "0.75rem" }}>
            Quick Messages (Editable)
          </h2>
          <QuickMessages />
        </section>

        <EditableLibrary
          storageKey="arabictalent_vault_docs"
          title="Reference Documents"
          icon={<IconDoc />}
          defaultItems={DEFAULT_DOCS}
          isLinks={true}
        />
      </div>

      <AgentBottomNav />
    </div>
  );
}

import { cookies } from "next/headers";
import { redirect }  from "next/navigation";
import Link          from "next/link";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { getLeadWithMessages }      from "@/lib/queries/agent";
import StatusUpdater                from "./StatusUpdater";
import ChatFeed, { ChatMessage }    from "./ChatFeed";
import LeadInfoTrigger              from "./LeadInfoTrigger";
import CallLeadButton               from "./CallLeadButton";
import styles from "../../agent.module.css";

// ── Helpers ───────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
function fmtDateLong(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
const STATUS_META: Record<string, { label: string; color: string }> = {
  NEW_LEAD:       { label: "New Lead",        color: "#60a5fa" },
  THINKING:       { label: "Thinking",        color: "#3b82f6" },
  INTERESTED:     { label: "Interested",      color: "#20C997" },
  FOLLOWUP:       { label: "Followup",        color: "#fb923c" },
  DEMO_ATTENDED:  { label: "Demo Attended",   color: "#c084fc" },
  NO_RESPONSE:    { label: "No Response",     color: "#9ca3af" },
  NOT_INTERESTED: { label: "Not Interested",  color: "#f87171" },
  CLOSED:         { label: "Closed ✓",        color: "#fbbf24" },
};

// ── Page ──────────────────────────────────────────────────────────────────
export default async function ChatPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  const user = await verifyToken(token);
  if (!user || user.role !== "AGENT") redirect("/login");

  const { leadId } = await params;
  const lead = await getLeadWithMessages(leadId, user.id);
  if (!lead) redirect("/dashboard/agent/inbox");

  const meta    = STATUS_META[lead.status] ?? STATUS_META["NEW_LEAD"];
  const dealAED = lead.dealValueCents
    ? `AED ${(Number(lead.dealValueCents) / 100).toLocaleString("en-AE")}`
    : null;

  const initialMsgs: ChatMessage[] = lead.messages.map((m) => ({
    id:         m.id,
    body:       m.body,
    direction:  m.direction,
    sentAt:     m.sentAt.toISOString(),
    senderName: m.sentBy?.name ?? null,
    mediaUrl:   m.mediaUrl,
    mediaType:  m.mediaType,
    isStatusReply: m.isStatusReply,
  }));

  // Serialised lead for the LeadInfoPanel (client)
  const serialisedLead = {
    id:             lead.id,
    name:           lead.name,
    phone:          lead.phone,
    company:        lead.company,
    profession:     lead.profession ?? null,
    country:        lead.country    ?? null,
    notes:          lead.notes,
    status:         lead.status,
    courseType:     lead.courseType     ?? null,
    paymentStatus:  lead.paymentStatus  ?? null,
    dealValueCents: lead.dealValueCents ? Number(lead.dealValueCents) : null,
    createdAt:      lead.createdAt.toISOString(),
  };

  return (
    <div className={styles.shell} style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className={styles.topbar} style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <Link href="/dashboard/agent/inbox" className={styles.backBtn} aria-label="Back">←</Link>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 500 }}>My Leads</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* Call Lead button */}
          <CallLeadButton leadId={lead.id} leadName={lead.name} />
          {/* Lead Info trigger button */}
          <LeadInfoTrigger lead={serialisedLead} />
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className={styles.logoutBtn}>Sign out</button>
          </form>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          LEAD CONTEXT HEADER
      ══════════════════════════════════════════════════════════ */}
      <div className={styles.chatHeader} style={{ flexShrink: 0 }}>

        <div className={styles.chatHeaderInner}>
          <div className={styles.leadAvatar}>{initials(lead.name)}</div>

          <div className={styles.chatHeaderInfo}>
            <div className={styles.chatLeadName}>{lead.name}</div>
            <div className={styles.chatLeadMeta}>
              {lead.phone}{lead.company ? ` · ${lead.company}` : ""}
            </div>
          </div>

          <span style={{
            fontSize: "0.62rem", fontWeight: 700, padding: "0.2rem 0.55rem",
            borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.05em",
            border: `1px solid ${meta.color}40`, background: `${meta.color}15`, color: meta.color,
            flexShrink: 0,
          }}>
            {meta.label}
          </span>
        </div>

        {/* Metadata strip */}
        <div style={{
          display: "flex", gap: "1.25rem", padding: "0 1.25rem 0.75rem",
          fontSize: "0.71rem", color: "var(--muted)", flexWrap: "wrap",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span>📅 {fmtDateLong(lead.createdAt)}</span>
          <span>📱 {lead.phone}</span>
          {dealAED && <span style={{ color: "#20C997" }}>💰 {dealAED}</span>}
          {lead.courseType && <span>📚 {lead.courseType}</span>}
          {lead.notes && (
            <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              📝 {lead.notes}
            </span>
          )}
          <span>💬 {lead.messages.length} message{lead.messages.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Status tags — CLOSED intercepts to modal */}
        <StatusUpdater leadId={lead.id} leadName={lead.name} currentStatus={lead.status} />
      </div>

      {/* ══════════════════════════════════════════════════════════
          CHAT FEED + INPUT
      ══════════════════════════════════════════════════════════ */}
      <ChatFeed
        leadId={lead.id}
        agentName={user.name}
        initialMsgs={initialMsgs}
      />
    </div>
  );
}

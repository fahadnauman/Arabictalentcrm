"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import styles from "../agent.module.css";

const FOLDERS = [
  { key: "ALL", label: "All Leads" },
  { key: "NEW_LEAD", label: "New Lead" },
  { key: "INTERESTED", label: "Interested" },
  { key: "NOT_INTERESTED", label: "Not Interested" },
  { key: "THINKING", label: "Thinking" },
  { key: "FOLLOWUP", label: "Followup" },
  { key: "DEMO_ATTENDED", label: "Demo Attended" },
];

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

const SALE_CHANCE: Record<string, number> = {
  NEW_LEAD:       30,
  THINKING:       50,
  INTERESTED:     80,
  FOLLOWUP:       60,
  DEMO_ATTENDED:  90,
  NO_RESPONSE:    10,
  NOT_INTERESTED: 0,
  CLOSED:         100,
};

function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)  return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60)     return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)      return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const IconChevron = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

// Extract a pure component for the Lead Card and memoize it to prevent re-renders
const LeadCard = React.memo(({ lead }: { lead: any }) => {
  const meta   = STATUS_META[lead.status] ?? STATUS_META["NEW_LEAD"];
  const chance = SALE_CHANCE[lead.status] ?? 35;
  const initials = lead.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Link
      href={`/dashboard/agent/chat/${lead.id}`}
      className={`${styles.leadCard} transition-all duration-200 ease-out`}
      style={lead.status === "INTERESTED" ? { borderColor: "#20C997", boxShadow: "0 0 12px rgba(32, 201, 151, 0.4)" } : {}}
    >
      <div className={styles.leadCardTop}>
        {/* Avatar + info */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1 }}>
          <div className={styles.leadAvatar} style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
            {initials}
          </div>
          <div>
            <div className={styles.leadName}>{lead.name}</div>
            {lead.company && <div className={styles.leadCompany}>{lead.company}</div>}
            <div className={styles.leadPhone}>{lead.phone}</div>
          </div>
        </div>
        {/* Right side */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
          <span className={`${styles.pill} ${meta.pill}`}>{meta.label}</span>
          <span style={{ fontSize: "0.65rem", color: "var(--dim)" }}>{timeAgo(lead.updatedAt)}</span>
        </div>
      </div>

      {/* Sale chance bar */}
      <div className={styles.chanceWrap}>
        <div className={styles.chanceLabel}>
          <span className={styles.chanceTxt}>Sale Chance</span>
          <span className={styles.chancePct} style={{ color: meta.barColor }}>{chance}%</span>
        </div>
        <div className={styles.chanceBar}>
          <div
            className={styles.chanceBarFill}
            style={{ width: `${chance}%`, background: meta.barColor, boxShadow: `0 0 6px ${meta.barColor}` }}
          />
        </div>
      </div>

      {/* Arrow */}
      <div style={{ position: "absolute", right: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--dim)" }}>
        <IconChevron />
      </div>
    </Link>
  );
});
LeadCard.displayName = "LeadCard";

export default function InboxClient({ initialLeads, activeCount }: { initialLeads: any[], activeCount: number }) {
  const [filter, setFilter] = useState("ALL");

  const filteredLeads = useMemo(() => {
    return initialLeads.filter(l => filter === "ALL" || l.status === filter);
  }, [initialLeads, filter]);

  return (
    <>
      {/* ── Folder Filters ────────────────────────────────────── */}
      <div style={{ height: "1rem" }} />
      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.5rem" }} className={styles.scrollHide}>
        {FOLDERS.map((folder) => {
          const isActive = filter === folder.key;
          return (
            <button
              key={folder.key} 
              onClick={() => setFilter(folder.key)}
              className="transition-all duration-200 ease-out"
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "20px",
                fontSize: "0.8rem",
                fontWeight: 600,
                whiteSpace: "nowrap",
                border: isActive ? "1px solid #20C997" : "1px solid rgba(255,255,255,0.1)",
                background: isActive ? "rgba(32, 201, 151, 0.15)" : "rgba(255,255,255,0.05)",
                color: isActive ? "#20C997" : "#8b8aa8",
                boxShadow: isActive ? "0 0 10px rgba(32, 201, 151, 0.3)" : "none",
                transition: "all 0.2s ease",
                cursor: "pointer",
                outline: "none"
              }}
            >
              {folder.label}
            </button>
          );
        })}
      </div>

      {/* ── Section header ─────────────────────────────────────── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>
          {FOLDERS.find(f => f.key === filter)?.label || "All Leads"}
        </span>
        <span className={styles.sectionCount}>{activeCount} active total</span>
      </div>

      {/* ── Lead cards ─────────────────────────────────────────── */}
      <div className={styles.leadList}>
        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--dim)", padding: "3rem 0", fontSize: "0.85rem" }}>
            No leads found in this folder.
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))
        )}
      </div>
      <div style={{ height: "0.5rem" }} />
    </>
  );
}

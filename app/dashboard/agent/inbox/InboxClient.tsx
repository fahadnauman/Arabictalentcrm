"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import styles from "../agent.module.css";

const FOLDERS = [
  { key: "ALL", label: "All Leads" },
  { key: "NEW_LEAD", label: "New Lead" },
  { key: "FOLLOW_UPS", label: "⏰ Follow-Ups" },
  { key: "HOT", label: "🔥 Hot" },
  { key: "WARM", label: "☀️ Warm" },
  { key: "COLD", label: "❄️ Cold" },
  { key: "THINKING", label: "Thinking" },
  { key: "DEMO_ATTENDED", label: "Demo Attended" },
  { key: "WAITING_FOR_PAYMENT", label: "Waiting for Payment" },
  { key: "NOT_INTERESTED", label: "Not Interested" },
];

const STATUS_META: Record<string, { label: string; pill: string; dot: string; barColor: string }> = {
  NEW_LEAD:            { label: "New Lead",            pill: styles.pillNew,  dot: "#60a5fa", barColor: "#3b82f6" },
  THINKING:            { label: "Thinking",            pill: styles.pillThin, dot: "#3b82f6", barColor: "#3b82f6" },
  INTERESTED:          { label: "Interested",          pill: styles.pillIntr, dot: "#20C997", barColor: "#20C997" },
  FOLLOWUP:            { label: "Followup",            pill: styles.pillThin, dot: "#fb923c", barColor: "#f97316" },
  DEMO_ATTENDED:       { label: "Demo Attended",       pill: styles.pillIntr, dot: "#c084fc", barColor: "#a855f7" },
  WAITING_FOR_PAYMENT: { label: "Waiting for Payment", pill: styles.pillIntr, dot: "#fbbf24", barColor: "#fbbf24" },
  NO_RESPONSE:         { label: "No Response",         pill: styles.pillNone, dot: "#9ca3af", barColor: "#6b7280" },
  NOT_INTERESTED:      { label: "Not Interested",      pill: styles.pillNint, dot: "#f87171", barColor: "#ef4444" },
  CLOSED:              { label: "Closed",              pill: styles.pillClos, dot: "#fbbf24", barColor: "#fbbf24" },
};

const SALE_CHANCE: Record<string, number> = {
  NEW_LEAD:            30,
  THINKING:            50,
  INTERESTED:          80,
  FOLLOWUP:            60,
  DEMO_ATTENDED:       90,
  WAITING_FOR_PAYMENT: 95,
  NO_RESPONSE:         10,
  NOT_INTERESTED:      0,
  CLOSED:              100,
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
  if (!lead || !lead.id) return null;

  const meta   = STATUS_META[lead.status] ?? STATUS_META["NEW_LEAD"];
  const chance = SALE_CHANCE[lead.status] ?? 35;
  const initials = (lead.name || "U").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
  const nextFollowUp = lead.followUps?.[0];

  let tempBorderClass = "";
  if (lead.temperature === "HOT") tempBorderClass = "border-l-[6px] border-l-red-500";
  else if (lead.temperature === "WARM") tempBorderClass = "border-l-[6px] border-l-amber-500";
  else if (lead.temperature === "COLD") tempBorderClass = "border-l-[6px] border-l-sky-500";

  return (
    <Link
      href={`/dashboard/agent/chat/${lead.id}`}
      onClick={() => {
        fetch(`/api/leads/${lead.id}/read`, { method: "POST" }).catch(() => {});
      }}
      className={`${styles.leadCard} transition-all duration-200 ease-out ${tempBorderClass}`}
      style={{
        position: "relative",
        paddingRight: "2.2rem",
        ...(nextFollowUp
          ? { borderColor: "rgba(249, 115, 22, 0.45)", boxShadow: "0 0 12px rgba(249, 115, 22, 0.2)" }
          : lead.status === "INTERESTED" || lead.temperature === "HOT"
          ? { borderColor: "#20C997", boxShadow: "0 0 12px rgba(32, 201, 151, 0.4)" }
          : {}),
      }}
    >
      <div className={styles.leadCardTop}>
        {/* Avatar + info */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flex: 1, minWidth: 0 }}>
          <div className={styles.leadAvatar} style={{ width: 38, height: 38, fontSize: "0.8rem", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className={styles.leadName} style={{ wordBreak: "break-word" }}>{lead.name}</div>
            {lead.company && <div className={styles.leadCompany} style={{ wordBreak: "break-word" }}>{lead.company}</div>}
            <div className={styles.leadPhone}>{lead.phone}</div>
          </div>
        </div>
        {/* Right side */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem", flexShrink: 0, marginLeft: "0.5rem" }}>
          <span className={`${styles.pill} ${meta.pill}`}>{meta.label}</span>
          <span style={{ fontSize: "0.65rem", color: "var(--dim)", whiteSpace: "nowrap" }}>{timeAgo(lead.updatedAt)}</span>
        </div>
      </div>

      {/* Follow-Up Banner if scheduled */}
      {nextFollowUp && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.4rem",
            marginTop: "0.4rem",
            padding: "0.3rem 0.55rem",
            background: "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.3)",
            borderRadius: "8px",
            fontSize: "0.72rem",
            color: "#fb923c",
          }}
        >
          <span>⏰</span>
          <span style={{ fontWeight: 700 }}>
            {new Date(nextFollowUp.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
            {new Date(nextFollowUp.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {nextFollowUp.note && (
            <span
              style={{
                color: "#c4c3dc",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.7rem",
              }}
            >
              • {nextFollowUp.note}
            </span>
          )}
        </div>
      )}

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
      <div style={{ position: "absolute", right: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "var(--dim)" }}>
        <IconChevron />
      </div>
    </Link>
  );
});
LeadCard.displayName = "LeadCard";

export default function InboxClient({ initialLeads = [], activeCount = 0 }: { initialLeads?: any[], activeCount?: number }) {
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter")?.toLowerCase();

  const resolveFilterKey = (param?: string | null) => {
    if (!param) return "ALL";
    if (param === "all") return "ALL";
    if (param === "follow-up" || param === "followup" || param === "follow_ups" || param === "followups") {
      return "FOLLOW_UPS";
    }
    if (param === "new" || param === "new_lead" || param === "new-lead" || param === "newleads") {
      return "NEW_LEAD";
    }
    if (param === "hot") return "HOT";
    if (param === "warm") return "WARM";
    if (param === "cold") return "COLD";
    if (param === "thinking") return "THINKING";
    if (param === "demo_attended" || param === "demoattended" || param === "demo") return "DEMO_ATTENDED";
    if (param === "waiting_for_payment" || param === "waiting" || param === "payment") return "WAITING_FOR_PAYMENT";
    if (param === "not_interested") return "NOT_INTERESTED";
    return "ALL";
  };

  const [filter, setFilter] = useState(() => resolveFilterKey(filterParam));
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (filterParam) {
      setFilter(resolveFilterKey(filterParam));
    }
  }, [filterParam]);

  const filteredLeads = useMemo(() => {
    let filtered = initialLeads;
    
    // Apply search filter first
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l => 
        (l.name && l.name.toLowerCase().includes(q)) || 
        (l.phone && l.phone.toLowerCase().includes(q))
      );
    }

    if (filter === "ALL") return filtered;
    if (filter === "FOLLOW_UPS") {
      return filtered.filter(
        (l) => l.status === "FOLLOWUP" || (l.followUps && l.followUps.length > 0)
      );
    }
    if (filter === "HOT") {
      return filtered.filter(l => l.temperature === "HOT");
    }
    if (filter === "WARM") {
      return filtered.filter(l => l.temperature === "WARM");
    }
    if (filter === "COLD") {
      return filtered.filter(l => l.temperature === "COLD");
    }
    return filtered.filter((l) => l.status === filter);
  }, [initialLeads, filter, searchQuery]);

  return (
    <>
      {/* ── Search Bar ────────────────────────────────────────── */}
      <div style={{ padding: "0.5rem 0", position: "relative" }}>
        <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#8b8aa8", pointerEvents: "none" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <input 
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="focus:ring-2 focus:ring-blue-500 focus:outline-none"
          style={{
            width: "100%",
            padding: "0.65rem 2.2rem",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f1f0ff",
            fontSize: "0.85rem",
            transition: "all 0.2s ease",
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.1)",
              border: "none",
              color: "#f1f0ff",
              borderRadius: "50%",
              width: "18px",
              height: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "10px",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Folder Filters ────────────────────────────────────── */}
      <div style={{ height: "0.5rem" }} />
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          WebkitOverflowScrolling: "touch",
        }}
        className={styles.scrollHide}
      >
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
                outline: "none",
                flexShrink: 0,
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
          {searchQuery ? "Search Results" : FOLDERS.find(f => f.key === filter)?.label || "New Leads"}
        </span>
        <span className={styles.sectionCount}>{filteredLeads.length} leads</span>
      </div>

      {/* ── Lead cards ─────────────────────────────────────────── */}
      <div className={styles.leadList}>
        {filteredLeads.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--dim)", padding: "3rem 0", fontSize: "0.85rem" }}>
            {searchQuery ? "No leads match your search." : "No leads found in this folder."}
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

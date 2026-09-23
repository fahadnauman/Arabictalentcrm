"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import styles from "../admin.module.css";

function formatDate(d: string | Date) {
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

export default function AdminLeadsClient({ initialLeads }: { initialLeads: any[] }) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return initialLeads;
    const q = searchQuery.toLowerCase();
    return initialLeads.filter((lead) => 
      (lead.name && lead.name.toLowerCase().includes(q)) || 
      (lead.phone && lead.phone.toLowerCase().includes(q))
    );
  }, [initialLeads, searchQuery]);

  return (
    <div className={styles.tablePanel}>
      {/* ── Search Bar ────────────────────────────────────────── */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
        <div style={{ position: "absolute", left: "36px", top: "50%", transform: "translateY(-50%)", color: "#8b8aa8", pointerEvents: "none" }}>
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
            maxWidth: "400px",
            padding: "0.65rem 2.2rem",
            borderRadius: "8px",
            background: "rgba(0,0,0,0.2)",
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
              left: "400px",
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

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Lead Details</th>
              <th>Contact Info</th>
              <th>Status</th>
              <th>Assigned Agent</th>
              <th>Deal Value</th>
              <th>Added On</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={6}>{searchQuery ? "No leads match your search." : "No leads in the system yet."}</td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const meta = STATUS_META[lead.status] || STATUS_META.NEW_LEAD;
                return (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`/dashboard/portfolio/${lead.id}`} style={{ textDecoration: "none" }}>
                        <div className={styles.leadName} style={{ color: "#20C997", cursor: "pointer" }}>
                          {lead.name}
                        </div>
                      </Link>
                      {lead.company && <div className={styles.leadPhone} style={{ fontSize: "0.7rem", marginTop: "2px" }}>🏢 {lead.company}</div>}
                    </td>
                    <td>
                      <div className={styles.leadPhone}>{lead.phone}</div>
                      {lead.email && <div className={styles.leadPhone} style={{ fontSize: "0.7rem" }}>{lead.email}</div>}
                    </td>
                    <td>
                      <span className={`${styles.pill} ${meta.pill}`}>{meta.label}</span>
                    </td>
                    <td>
                      {lead.assignedAgent ? (
                        <span style={{ color: "#f1f0ff", fontWeight: 500, fontSize: "0.85rem" }}>{lead.assignedAgent.name}</span>
                      ) : (
                        <span style={{ color: "#4e4d6a", fontStyle: "italic", fontSize: "0.85rem" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {lead.dealValueCents ? (
                        <span style={{ color: "#20C997", fontWeight: 700, letterSpacing: "-0.01em" }}>
                          AED {(Number(lead.dealValueCents) / 100).toLocaleString("en-AE")}
                        </span>
                      ) : (
                        <span style={{ color: "#4e4d6a" }}>-</span>
                      )}
                    </td>
                    <td>{formatDate(lead.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "../agent.module.css";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW_LEAD:       { label: "New Lead",        color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  THINKING:       { label: "Thinking",        color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  INTERESTED:     { label: "Interested",      color: "#20C997", bg: "rgba(32,201,151,0.1)" },
  NO_RESPONSE:    { label: "No Response",     color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  NOT_INTERESTED: { label: "Not Interested",  color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  CLOSED:         { label: "Closed ✓",        color: "#fbbf24", bg: "rgba(251,191,36,0.1)" },
};

type Lead = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  status: string;
  courseType: string | null;
  dealValueCents: bigint | null;
  notes: string | null;
};

export default function PortfolioClientList({ initialLeads }: { initialLeads: Lead[] }) {
  const [search, setSearch] = useState("");

  const filteredLeads = initialLeads.filter(lead => {
    const q = search.toLowerCase();
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.phone.includes(q) ||
      (lead.company && lead.company.toLowerCase().includes(q)) ||
      (lead.courseType && lead.courseType.toLowerCase().includes(q)) ||
      (lead.notes && lead.notes.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search leads by name, phone, course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "0.8rem 1rem",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            fontSize: "0.95rem",
            outline: "none"
          }}
        />
      </div>

      {filteredLeads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#4e4d6a" }}>
          {initialLeads.length === 0 ? "No leads assigned yet." : "No leads match your search."}
        </div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {filteredLeads.map(lead => {
            const meta = STATUS_META[lead.status] || STATUS_META.NEW_LEAD;
            return (
              <div key={lead.id} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
              }}>
                {/* Header: Name & Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <Link href={`/dashboard/portfolio/${lead.id}`} style={{ textDecoration: "none" }}>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#20C997", fontWeight: 700 }}>{lead.name}</h3>
                    </Link>
                    <div style={{ fontSize: "0.75rem", color: "#8b8aa8", marginTop: "0.2rem" }}>
                      {lead.phone} {lead.company ? `• ${lead.company}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase",
                      padding: "0.25rem 0.6rem", borderRadius: "99px",
                      background: meta.bg, color: meta.color, border: `1px solid ${meta.color}40`
                    }}>
                      {meta.label}
                    </span>
                    <Link href={`/dashboard/agent/chat/${lead.id}`} style={{
                      fontSize: "0.7rem", fontWeight: 700, color: "#f0f0ff", background: "rgba(255,255,255,0.05)",
                      padding: "0.3rem 0.6rem", borderRadius: "6px", textDecoration: "none", border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                      💬 Chat
                    </Link>
                  </div>
                </div>

                {/* Body: Course & Deal */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "10px" }}>
                  <div>
                    <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a88", marginBottom: "0.2rem" }}>Course Interest</div>
                    <div style={{ fontSize: "0.85rem", color: lead.courseType ? "#f1f0ff" : "#4e4d6a", fontWeight: 500 }}>
                      {lead.courseType || "None specified"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a88", marginBottom: "0.2rem" }}>Deal Value</div>
                    <div style={{ fontSize: "0.85rem", color: lead.dealValueCents ? "#20C997" : "#4e4d6a", fontWeight: 700 }}>
                      {lead.dealValueCents ? `AED ${(Number(lead.dealValueCents) / 100).toLocaleString("en-AE")}` : "-"}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {lead.notes && (
                  <div style={{ borderLeft: "3px solid rgba(124,58,237,0.5)", paddingLeft: "0.75rem" }}>
                    <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#6b6a88", marginBottom: "0.25rem" }}>Pipeline Notes</div>
                    <div style={{ fontSize: "0.8rem", color: "#c4c3dc", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

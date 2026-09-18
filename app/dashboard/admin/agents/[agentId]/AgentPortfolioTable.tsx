"use client";

import { useState } from "react";
import Link from "next/link";
import LeadTransferModal from "./LeadTransferModal";
import styles from "../../admin.module.css";

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  profession: string | null;
  country: string | null;
  status: string;
  dealValueCents: bigint | number | string | null;
  createdAt: string | Date;
}

interface TargetAgentOption {
  id: string;
  name: string;
  email: string;
  languageGroup: string;
}

interface AgentPortfolioTableProps {
  leads: LeadItem[];
  currentAgentId: string;
  availableAgents: TargetAgentOption[];
}

const STATUS_META: Record<string, { label: string; pill: string }> = {
  NEW_LEAD:       { label: "New Lead",       pill: styles.pillNew  },
  THINKING:       { label: "Thinking",       pill: styles.pillThin },
  INTERESTED:     { label: "Interested",     pill: styles.pillIntr },
  WAITING_FOR_PAYMENT: { label: "Awaiting Pay", pill: styles.pillThin },
  NO_RESPONSE:    { label: "No Response",    pill: styles.pillNone },
  NOT_INTERESTED: { label: "Not Interested", pill: styles.pillNint },
  CLOSED:         { label: "Closed",         pill: styles.pillClos },
};

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}

export default function AgentPortfolioTable({
  leads,
  currentAgentId,
  availableAgents,
}: AgentPortfolioTableProps) {
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  return (
    <>
      <div className={styles.tablePanel}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Lead Details</th>
                <th>Contact Info</th>
                <th>Status</th>
                <th>Deal Value</th>
                <th>Added On</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={6}>No leads assigned yet.</td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const meta = STATUS_META[lead.status] || STATUS_META.NEW_LEAD;
                  return (
                    <tr key={lead.id}>
                      <td>
                        <Link href={`/dashboard/portfolio/${lead.id}`} style={{ textDecoration: "none" }}>
                          <div className={styles.leadName} style={{ color: "#20C997", cursor: "pointer" }}>
                            {lead.name}
                          </div>
                        </Link>
                        {lead.profession && (
                          <div className={styles.leadPhone} style={{ fontSize: "0.7rem", marginTop: "2px" }}>
                            💼 {lead.profession}
                          </div>
                        )}
                        {lead.country && (
                          <div className={styles.leadPhone} style={{ fontSize: "0.7rem" }}>
                            🌍 {lead.country}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.leadPhone}>{lead.phone}</div>
                        {lead.email && (
                          <div className={styles.leadPhone} style={{ fontSize: "0.7rem" }}>
                            {lead.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`${styles.pill} ${meta.pill}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        {lead.dealValueCents ? (
                          <span style={{ color: "#20C997", fontWeight: 700 }}>
                            AED {(Number(lead.dealValueCents) / 100).toLocaleString("en-AE")}
                          </span>
                        ) : (
                          <span style={{ color: "#4e4d6a" }}>-</span>
                        )}
                      </td>
                      <td>{formatDate(lead.createdAt)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsTransferOpen(true);
                          }}
                          style={{
                            padding: "0.35rem 0.75rem",
                            borderRadius: "6px",
                            background: "rgba(0, 255, 255, 0.08)",
                            border: "1px solid rgba(0, 255, 255, 0.3)",
                            color: "#00ffff",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(0, 255, 255, 0.2)";
                            e.currentTarget.style.borderColor = "#00ffff";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(0, 255, 255, 0.08)";
                            e.currentTarget.style.borderColor = "rgba(0, 255, 255, 0.3)";
                          }}
                        >
                          ⇄ Transfer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LeadTransferModal
        isOpen={isTransferOpen}
        onClose={() => {
          setIsTransferOpen(false);
          setSelectedLead(null);
        }}
        lead={selectedLead}
        currentAgentId={currentAgentId}
        availableAgents={availableAgents}
      />
    </>
  );
}

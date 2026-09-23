"use client";

import { useState, useTransition, useOptimistic } from "react";
import { updateLeadStatus, updateLeadTemperature } from "@/app/actions/lead";
import CloseDealModal              from "./CloseDealModal";
import styles from "../../agent.module.css";
import type { LeadTemperature, LeadStatus } from "@prisma/client";

const STATUS_TAGS = [
  { status: "CLOSED",              label: "✓ Closed",             cls: styles.tagClosed },
  { status: "THINKING",            label: "⏳ Thinking",          cls: styles.tagThink  },
  { status: "DEMO_ATTENDED",       label: "🖥️ Demo Attended",     cls: styles.tagThink  },
  { status: "WAITING_FOR_PAYMENT", label: "💳 Waiting for Payment",cls: styles.tagIntr   },
  { status: "NOT_INTERESTED",      label: "✗ Not Interested",     cls: styles.tagNoint  },
] as const;

interface Props {
  leadId:             string;
  leadName:           string;
  currentStatus:      string;
  currentTemperature: string;
}

export default function StatusUpdater({ leadId, leadName, currentStatus, currentTemperature }: Props) {
  const [showDealModal, setShowDealModal] = useState(false);
  const [isPending,     startTx]          = useTransition();
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    currentStatus,
    (state: string, newStatus: string) => newStatus
  );
  const [optimisticTemp, addOptimisticTemp] = useOptimistic(
    currentTemperature,
    (state: string, newTemp: string) => newTemp
  );

  function handleStatusClick(newStatus: string) {
    if (newStatus === optimisticStatus || isPending) return;

    if (newStatus === "CLOSED") {
      setShowDealModal(true);
      return;
    }

    startTx(async () => {
      addOptimisticStatus(newStatus);
      await updateLeadStatus(leadId, newStatus as LeadStatus);
    });
  }

  function handleTempClick(newTemp: string) {
    if (newTemp === optimisticTemp || isPending) return;
    
    startTx(async () => {
      addOptimisticTemp(newTemp);
      await updateLeadTemperature(leadId, newTemp as LeadTemperature);
    });
  }

  function handleDealSaved() {
    startTx(async () => {
      addOptimisticStatus("CLOSED");
    });
    setShowDealModal(false);
  }

  return (
    <>
      <div 
        className={`${styles.statusTags} scrollbar-hide`} 
        aria-label="Update lead status"
        style={{ 
          overflowX: "auto", 
          whiteSpace: "nowrap", 
          display: "flex", 
          gap: "0.5rem", 
          padding: "0.25rem 1.25rem 0.5rem",
          msOverflowStyle: "none",
          scrollbarWidth: "none"
        }}
      >
        {/* ── TEMPERATURE BUTTONS ── */}
        <button
          onClick={() => handleTempClick("HOT")}
          disabled={isPending}
          className={styles.statusTag}
          style={{
            background: optimisticTemp === "HOT" ? "#ef4444" : "rgba(239, 68, 68, 0.1)",
            color: optimisticTemp === "HOT" ? "#fff" : "#ef4444",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          🔥 Hot
        </button>
        
        <button
          onClick={() => handleTempClick("WARM")}
          disabled={isPending}
          className={styles.statusTag}
          style={{
            background: optimisticTemp === "WARM" ? "#f59e0b" : "rgba(245, 158, 11, 0.1)",
            color: optimisticTemp === "WARM" ? "#fff" : "#f59e0b",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          ☀️ Warm
        </button>

        <button
          onClick={() => handleTempClick("COLD")}
          disabled={isPending}
          className={styles.statusTag}
          style={{
            background: optimisticTemp === "COLD" ? "#3b82f6" : "rgba(59, 130, 246, 0.1)",
            color: optimisticTemp === "COLD" ? "#fff" : "#3b82f6",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            flexShrink: 0,
          }}
        >
          ❄️ Cold
        </button>

        {/* ── STATUS BUTTONS ── */}
        {STATUS_TAGS.map(({ status, label, cls }) => (
          <button
            key={status}
            onClick={() => handleStatusClick(status)}
            disabled={isPending}
            className={`${styles.statusTag} ${cls} ${optimisticStatus === status ? styles.active : ""}`}
            style={{ flexShrink: 0 }}
            aria-pressed={optimisticStatus === status}
          >
            {label}
          </button>
        ))}
      </div>

      {showDealModal && (
        <CloseDealModal
          leadId={leadId}
          leadName={leadName}
          onClose={() => setShowDealModal(false)}
          onSaved={handleDealSaved}
        />
      )}
    </>
  );
}

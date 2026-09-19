"use client";

import { useState, useTransition, useOptimistic } from "react";
import { updateLeadStatus }        from "@/app/actions/lead";
import CloseDealModal              from "./CloseDealModal";
import SetFollowUpModal           from "./SetFollowUpModal";
import styles from "../../agent.module.css";

const TAGS = [
  { status: "CLOSED",         label: "✓ Closed",          cls: styles.tagClosed },
  { status: "THINKING",       label: "💭 Thinking",        cls: styles.tagThink  },
  { status: "NOT_INTERESTED", label: "✗ Not Interested",   cls: styles.tagNoint  },
  { status: "NO_RESPONSE",    label: "○ No Response",      cls: styles.tagNoresp },
  { status: "NEW_LEAD",       label: "★ New Lead",         cls: styles.tagNew    },
] as const;

interface Props {
  leadId:        string;
  leadName:      string;
  currentStatus: string;
}

export default function StatusUpdater({ leadId, leadName, currentStatus }: Props) {
  const [showDealModal, setShowDealModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [isPending,     startTx]          = useTransition();
  const [optimisticStatus, addOptimisticStatus] = useOptimistic(
    currentStatus,
    (state: string, newStatus: string) => newStatus
  );

  function handleClick(newStatus: string) {
    if (newStatus === optimisticStatus || isPending) return;

    // ── Intercept CLOSED → open revenue modal ──────────────────
    if (newStatus === "CLOSED") {
      setShowDealModal(true);
      return;
    }

    // ── All other statuses — instant optimistic update ─────────
    startTx(async () => {
      addOptimisticStatus(newStatus);
      await updateLeadStatus(leadId, newStatus as any);
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
      <div className={styles.statusTags} aria-label="Update lead status">
        {TAGS.map(({ status, label, cls }) => (
          <button
            key={status}
            onClick={() => handleClick(status)}
            disabled={isPending}
            className={`${styles.statusTag} ${cls} ${optimisticStatus === status ? styles.active : ""}`}
            aria-pressed={optimisticStatus === status}
          >
            {label}
          </button>
        ))}

        {/* Set Follow-Up Action Button */}
        <button
          type="button"
          onClick={() => setShowFollowUpModal(true)}
          disabled={isPending}
          className={styles.statusTag}
          style={{
            background: optimisticStatus === "FOLLOWUP" ? "rgba(249, 115, 22, 0.25)" : "rgba(249, 115, 22, 0.12)",
            border: "1px solid rgba(249, 115, 22, 0.4)",
            color: "#fb923c",
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Schedule date, time & callback note"
        >
          ⏰ Set Follow-Up
        </button>
      </div>

      {showDealModal && (
        <CloseDealModal
          leadId={leadId}
          leadName={leadName}
          onClose={() => setShowDealModal(false)}
          onSaved={handleDealSaved}
        />
      )}

      {showFollowUpModal && (
        <SetFollowUpModal
          leadId={leadId}
          leadName={leadName}
          onClose={() => setShowFollowUpModal(false)}
          onScheduled={() => {
            addOptimisticStatus("FOLLOWUP");
          }}
        />
      )}
    </>
  );
}

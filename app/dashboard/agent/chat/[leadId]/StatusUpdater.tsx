"use client";

import { useState, useTransition, useOptimistic } from "react";
import { updateLeadStatus }        from "@/app/actions/lead";
import CloseDealModal              from "./CloseDealModal";
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

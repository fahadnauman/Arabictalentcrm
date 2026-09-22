"use client";

import { useState } from "react";
import SetFollowUpModal from "./SetFollowUpModal";

interface SetFollowUpButtonProps {
  leadId: string;
  leadName: string;
}

export default function SetFollowUpButton({
  leadId,
  leadName,
}: SetFollowUpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          height: 32,
          padding: "0 0.75rem",
          borderRadius: "99px",
          background: "rgba(249, 115, 22, 0.15)",
          border: "1.5px solid rgba(249, 115, 22, 0.45)",
          color: "#fb923c",
          fontSize: "0.74rem",
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flexShrink: 0,
          boxShadow: "0 0 10px rgba(249, 115, 22, 0.2)",
          transition: "all 0.15s ease",
        }}
        title="Schedule date, time & callback note for this lead"
      >
        <span>⏰</span>
        <span>Set Follow-Up</span>
      </button>

      {isOpen && (
        <SetFollowUpModal
          leadId={leadId}
          leadName={leadName}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}

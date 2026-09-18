"use client";

import { useState } from "react";
import AgentStatusToggle from "./AgentStatusToggle";
import EditAgentModal from "./EditAgentModal";

interface AgentHeaderControlsProps {
  agent: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    languageGroup: string;
    isActive: boolean;
  };
}

export default function AgentHeaderControls({ agent }: AgentHeaderControlsProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button
          type="button"
          onClick={() => setIsEditOpen(true)}
          style={{
            padding: "0.45rem 0.9rem",
            borderRadius: "8px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#f1f0ff",
            fontSize: "0.8rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#20C997";
            e.currentTarget.style.color = "#20C997";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.color = "#f1f0ff";
          }}
        >
          ✎ Edit Agent
        </button>
        <AgentStatusToggle agentId={agent.id} initialStatus={agent.isActive} />
      </div>

      <EditAgentModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        agent={agent}
      />
    </>
  );
}

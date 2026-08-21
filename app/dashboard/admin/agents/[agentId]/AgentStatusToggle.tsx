"use client";

import { useState, useTransition } from "react";
import { toggleAgentStatus } from "@/app/actions/agent";
import { useRouter } from "next/navigation";

export default function AgentStatusToggle({ agentId, initialStatus }: { agentId: string, initialStatus: boolean }) {
  const [isActive, setIsActive] = useState(initialStatus);
  const [isPending, startTx] = useTransition();
  const router = useRouter();

  const handleToggle = (checked: boolean) => {
    setIsActive(checked);
    startTx(async () => {
      try {
        await toggleAgentStatus(agentId, checked);
        router.refresh();
      } catch (err) {
        setIsActive(!checked); // revert on error
        console.error("Failed to toggle status", err);
      }
    });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(255,255,255,0.03)", padding: "0.5rem 1rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: isActive ? "#20C997" : "#8b8aa8", textTransform: "uppercase" }}>
        {isActive ? "Active (Routing On)" : "Inactive"}
      </div>
      <label style={{ position: "relative", display: "inline-block", width: "40px", height: "22px" }}>
        <input 
          type="checkbox" 
          checked={isActive} 
          onChange={e => handleToggle(e.target.checked)} 
          disabled={isPending} 
          style={{ opacity: 0, width: 0, height: 0 }} 
        />
        <span style={{
          position: "absolute", cursor: isPending ? "not-allowed" : "pointer", inset: 0, borderRadius: "24px",
          background: isActive ? "#20C997" : "rgba(255,255,255,0.1)", transition: "0.3s", opacity: isPending ? 0.6 : 1
        }}>
          <span style={{
            position: "absolute", height: "16px", width: "16px", left: isActive ? "21px" : "3px", bottom: "3px",
            background: "white", borderRadius: "50%", transition: "0.3s"
          }} />
        </span>
      </label>
    </div>
  );
}

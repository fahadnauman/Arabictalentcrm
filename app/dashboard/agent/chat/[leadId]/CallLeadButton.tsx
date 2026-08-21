"use client";

import { useState } from "react";
import styles from "../../agent.module.css";

export default function CallLeadButton({ leadId, leadName }: { leadId: string; leadName: string }) {
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleCall() {
    setIsCalling(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/calls/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate call");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsCalling(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleCall}
        disabled={isCalling}
        style={{
          background: isCalling ? "rgba(255,255,255,0.1)" : success ? "rgba(32, 201, 151, 0.2)" : "rgba(124, 58, 237, 0.2)",
          border: `1px solid ${isCalling ? "rgba(255,255,255,0.2)" : success ? "rgba(32, 201, 151, 0.5)" : "rgba(124, 58, 237, 0.5)"}`,
          color: success ? "#20C997" : "#a78bfa",
          padding: "0.4rem 0.8rem",
          borderRadius: "8px",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: isCalling ? "wait" : "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          transition: "all 0.2s ease"
        }}
        title={`Call ${leadName}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        {isCalling ? "Dialing..." : success ? "Connecting!" : "Call Lead"}
      </button>
      
      {error && (
        <div style={{ position: "absolute", top: "120%", right: 0, background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171", padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.65rem", whiteSpace: "nowrap", zIndex: 10 }}>
          {error}
        </div>
      )}
    </div>
  );
}

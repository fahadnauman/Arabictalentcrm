"use client";

import { useState } from "react";
import LeadInfoPanel from "./LeadInfoPanel";

interface Lead {
  id: string; name: string; phone: string; company: string | null;
  profession: string | null; country: string | null;
  notes: string | null; status: string; courseType: string | null;
  paymentStatus: string | null; dealValueCents: number | null; createdAt: string;
}

export default function LeadInfoTrigger({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Lead Info"
        style={{
          display: "flex", alignItems: "center", gap: "0.35rem",
          padding: "0.25rem 0.7rem", borderRadius: 8, cursor: "pointer",
          background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)",
          color: "#a78bfa", fontSize: "0.75rem", fontWeight: 600, fontFamily: "inherit",
          transition: "background 0.15s",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Info
      </button>

      {open && <LeadInfoPanel lead={lead} onClose={() => setOpen(false)} />}
    </>
  );
}

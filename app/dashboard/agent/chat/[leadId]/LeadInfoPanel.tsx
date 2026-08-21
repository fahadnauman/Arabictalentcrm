"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { updateLeadInfo } from "@/app/actions/lead";

interface Lead {
  id:      string;
  name:    string;
  phone:   string;
  company: string | null;
  profession: string | null;
  country: string | null;
  notes:   string | null;
  status:  string;
  courseType:    string | null;
  paymentStatus: string | null;
  dealValueCents: number | null;
  createdAt: string;
}

interface Props {
  lead:    Lead;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  NEW_LEAD:       "🔵 New Lead",
  THINKING:       "💭 Thinking",
  NO_RESPONSE:    "⚪ No Response",
  NOT_INTERESTED: "❌ Not Interested",
  CLOSED:         "✅ Closed",
};

export default function LeadInfoPanel({ lead, onClose }: Props) {
  const [name,       setName]       = useState(lead.name);
  const [phone,      setPhone]      = useState(lead.phone);
  const [company,    setCompany]    = useState(lead.company ?? "");
  const [profession, setProfession] = useState(lead.profession ?? "");
  const [country,    setCountry]    = useState(lead.country ?? "");
  const [courseType, setCourseType] = useState(lead.courseType ?? "");
  const [paymentStatus, setPaymentStatus] = useState(lead.paymentStatus ?? "");
  const [notes,      setNotes]      = useState(lead.notes   ?? "");
  const [saved,      setSaved]      = useState(false);
  const [error,      setError]      = useState("");
  const [isPending, startTx]  = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false);
    if (!name.trim()) { setError("Name cannot be empty."); return; }
    
    // Optimistic success state
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);

    startTx(async () => {
      try {
        await updateLeadInfo(lead.id, { 
          name, phone, company, profession, country, notes, courseType, 
          paymentStatus: paymentStatus || undefined 
        });
      } catch (err: any) {
        setError(err?.message ?? "Failed to save.");
        setSaved(false);
      }
    });
  }

  const dealAED = lead.dealValueCents != null
    ? `AED ${(lead.dealValueCents / 100).toLocaleString("en-AE")}`
    : null;

  // Use Portal to prevent any parent overflow: hidden from clipping the fixed drawer
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    /* Backdrop */
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      {/* Slide-up sheet */}
      <div
        ref={panelRef}
        style={{
          width: "100%", maxWidth: 480,
          background: "linear-gradient(180deg,#0f1428 0%,#0a0e1a 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "92vh",
          overflowY: "auto",
          animation: "slideUp 0.25s ease",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0.5rem", position: "sticky", top: 0, background: "#0f1428", zIndex: 1 }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: "rgba(255,255,255,0.15)" }} />
        </div>

        <div style={{ padding: "0 1.5rem 2.5rem" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#f0f0ff", margin: 0 }}>
                Lead Info
              </h2>
              <p style={{ fontSize: "0.75rem", color: "#8b8aa8", margin: "0.15rem 0 0" }}>
                View and edit contact details
              </p>
            </div>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#8b8aa8", width: 32, height: 32, borderRadius: 8,
              cursor: "pointer", fontSize: "1rem",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>

          {/* Read-only context strip */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "0.85rem 1rem",
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem", marginBottom: "1.25rem",
          }}>
            <InfoChip label="Phone"   value={lead.phone}                               />
            <InfoChip label="Status"  value={STATUS_LABELS[lead.status] ?? lead.status.replace(/_/g, " ")} />
            <InfoChip label="Joined"  value={new Date(lead.createdAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })} />
            {dealAED && <InfoChip label="Deal Value" value={dealAED} highlight />}
            {lead.courseType    && <InfoChip label="Course"  value={lead.courseType} />}
            {lead.paymentStatus && <InfoChip label="Payment" value={lead.paymentStatus} />}
          </div>

          {/* Editable form */}
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <FormField id="pi-name"    label="Full Name *">
              <input id="pi-name" value={name}    onChange={e => setName(e.target.value)}    style={inputSty} disabled={isPending} />
            </FormField>

            <FormField id="pi-phone"   label="Phone Number">
              <input id="pi-phone" value={phone}   onChange={e => setPhone(e.target.value)}  style={inputSty} disabled={isPending} />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <FormField id="pi-profession" label="Profession">
                <input id="pi-profession" value={profession} onChange={e => setProfession(e.target.value)} style={inputSty} disabled={isPending} placeholder="e.g. Engineer" />
              </FormField>
              <FormField id="pi-country" label="Country">
                <input id="pi-country" value={country} onChange={e => setCountry(e.target.value)} style={inputSty} disabled={isPending} placeholder="e.g. UAE" />
              </FormField>
            </div>

            <FormField id="pi-course" label="Course Interest">
              <input id="pi-course" value={courseType} onChange={e => setCourseType(e.target.value)} style={inputSty} disabled={isPending} placeholder="e.g. Arabic for Business" />
            </FormField>

            <FormField id="pi-notes"   label="Pipeline Notes & Context">
              <textarea
                id="pi-notes" value={notes} rows={5}
                onChange={e => setNotes(e.target.value)}
                placeholder="Write detailed notes about this lead's situation, objections, interests, follow-up dates…"
                disabled={isPending}
                style={{ ...inputSty, resize: "vertical", minHeight: 100, lineHeight: 1.6 }}
              />
            </FormField>

            {error  && <div style={errorSty}>⚠ {error}</div>}
            {saved  && <div style={successSty}>✓ Saved successfully!</div>}

            <button type="submit" disabled={isPending} style={{
              padding: "0.8rem", borderRadius: 12, border: "none",
              background: isPending ? "rgba(124,58,237,0.4)" : "linear-gradient(135deg,#7c3aed,#9333ea)",
              color: "white", fontWeight: 700, fontSize: "0.9rem",
              fontFamily: "inherit", cursor: isPending ? "not-allowed" : "pointer",
              boxShadow: "0 3px 14px rgba(124,58,237,0.4)",
            }}>
              {isPending ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function InfoChip({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#4e4d6a", marginBottom: "0.2rem" }}>{label}</div>
      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: highlight ? "#20C997" : "#c4c3dc", wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}
function FormField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <label htmlFor={id} style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#8b8aa8" }}>{label}</label>
      {children}
    </div>
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "0.7rem 0.9rem", color: "#f0f0ff", fontSize: "0.875rem",
  fontFamily: "inherit", outline: "none",
};
const errorSty: React.CSSProperties = {
  padding: "0.6rem 0.85rem", borderRadius: 9, fontSize: "0.8rem",
  background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171",
};
const successSty: React.CSSProperties = {
  padding: "0.6rem 0.85rem", borderRadius: 9, fontSize: "0.8rem",
  background: "rgba(32,201,151,0.08)", border: "1px solid rgba(32,201,151,0.25)", color: "#20C997",
};

"use client";

import { useActionState } from "react";
import { createLeadAction, CreateLeadResult } from "@/app/actions/admin";

const initial: CreateLeadResult | null = null;

export default function LeadForm() {
  const [state, action, pending] = useActionState(createLeadAction, initial);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

      {/* Error / duplicate notice */}
      {state && !state.success && (
        <div style={{
          padding: "0.75rem 1rem", borderRadius: "10px",
          background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
          color: "#f87171", fontSize: "0.85rem",
        }}>
          ⚠ {state.error}
          {state.leadId && (
            <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.75rem", opacity: 0.7 }}>
              Lead ID: {state.leadId}
            </span>
          )}
        </div>
      )}

      {/* Fields */}
      {[
        { id: "name",    label: "Full Name *",      type: "text",    placeholder: "Ahmed Al-Rashid",        required: true  },
        { id: "phone",   label: "WhatsApp Number *", type: "tel",     placeholder: "+971 50 123 4567",       required: true  },
        { id: "company", label: "Company",           type: "text",    placeholder: "Gulf Tech LLC",          required: false },
        { id: "deal",    label: "Deal Value (AED)",  type: "number",  placeholder: "5000",                   required: false },
      ].map(({ id, label, type, placeholder, required }) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label htmlFor={id} style={{
            fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em",
            textTransform: "uppercase", color: "#8b8aa8",
          }}>
            {label}
          </label>
          <input
            id={id} name={id} type={type}
            placeholder={placeholder}
            required={required}
            step={type === "number" ? "0.01" : undefined}
            min={type === "number" ? "0" : undefined}
            disabled={pending}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", padding: "0.7rem 0.9rem",
              color: "#f0f0ff", fontSize: "0.9rem", fontFamily: "inherit",
              outline: "none", width: "100%",
              transition: "border-color 0.2s",
            }}
          />
        </div>
      ))}

      {/* Notes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <label htmlFor="notes" style={{
          fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.05em",
          textTransform: "uppercase", color: "#8b8aa8",
        }}>
          Notes
        </label>
        <textarea
          id="notes" name="notes"
          placeholder="Any context about this lead…"
          rows={3}
          disabled={pending}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px", padding: "0.7rem 0.9rem",
            color: "#f0f0ff", fontSize: "0.9rem", fontFamily: "inherit",
            outline: "none", resize: "vertical", width: "100%",
          }}
        />
      </div>

      {/* Auto-assign notice */}
      <div style={{
        padding: "0.6rem 0.9rem", borderRadius: "9px",
        background: "rgba(32,201,151,0.06)", border: "1px solid rgba(32,201,151,0.2)",
        fontSize: "0.78rem", color: "rgba(32,201,151,0.8)",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <span>⚡</span>
        <span>This lead will be auto-assigned to the next agent in the round-robin queue.</span>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: "0.8rem", borderRadius: "12px", border: "none",
          background: pending
            ? "rgba(124,58,237,0.4)"
            : "linear-gradient(135deg,#7c3aed,#9333ea)",
          color: "white", fontSize: "0.9rem", fontWeight: 700,
          fontFamily: "inherit", cursor: pending ? "not-allowed" : "pointer",
          boxShadow: "0 3px 14px rgba(124,58,237,0.4)",
          transition: "opacity 0.2s",
        }}
      >
        {pending ? "Creating lead…" : "Create & Assign Lead →"}
      </button>
    </form>
  );
}

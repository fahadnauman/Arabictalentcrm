"use client";

import { useState, useTransition, useEffect } from "react";
import { closeDeal }                          from "@/app/actions/lead";
import { PaymentStatus }                      from "@prisma/client";

interface Props {
  leadId:    string;
  leadName:  string;
  onClose:   () => void;
  onSaved:   () => void;
}

const COURSE_OPTIONS = [
  "Standard Arabic",
  "Business Arabic",
  "Quranic Arabic",
  "Kids Arabic",
  "Conversational Arabic",
  "Advanced Arabic",
  "Custom / Other",
];

export default function CloseDealModal({ leadId, leadName, onClose, onSaved }: Props) {
  const [courseType,    setCourseType]    = useState(COURSE_OPTIONS[0]);
  const [customCourse,  setCustomCourse]  = useState("");
  const [amountAED,     setAmountAED]     = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("FULL");
  const [error,         setError]         = useState("");
  const [isPending,     startTx]          = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const finalCourse = courseType === "Custom / Other" ? customCourse.trim() : courseType;
    const amount      = parseFloat(amountAED);

    if (!finalCourse) { setError("Please specify the course type."); return; }
    if (!amountAED || isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    startTx(async () => {
      try {
        await closeDeal(leadId, { courseType: finalCourse, amountAED: amount, paymentStatus });
        onSaved();
      } catch (err: any) {
        setError(err?.message ?? "Failed to save. Please try again.");
      }
    });
  }

  return (
    /* Centered Backdrop */
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.8)",
        backdropFilter: "blur(6px)",
        display: "grid", placeItems: "center",
        padding: "1rem",
      }}
    >
      {/* Centered Modal Card */}
      <div style={{
        width: "100%", maxWidth: 440,
        background: "linear-gradient(180deg,#0f1428 0%,#0a0e1a 100%)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: "1.5rem",
        animation: "scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        maxHeight: "90vh",
        overflowY: "auto",
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
      }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#20C997", boxShadow: "0 0 8px #20C997" }} />
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f0f0ff" }}>Close This Deal</span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#8b8aa8", margin: 0 }}>
              Capturing revenue for <strong style={{ color: "#c4c3dc" }}>{leadName}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#8b8aa8",
            width: 32, height: 32, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
          }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          <div>
            <label style={labelStyle}>Course Type *</label>
            <select value={courseType} onChange={(e) => setCourseType(e.target.value)} disabled={isPending} style={inputStyle}>
              {COURSE_OPTIONS.map((o) => (
                <option key={o} value={o} style={{ background: "#0f1428" }}>{o}</option>
              ))}
            </select>
          </div>

          {courseType === "Custom / Other" && (
            <div>
              <label style={labelStyle}>Specify Course *</label>
              <input type="text" value={customCourse} onChange={(e) => setCustomCourse(e.target.value)} placeholder="e.g. Corporate Arabic" disabled={isPending} style={inputStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Course Amount (AED) *</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", fontSize: "0.85rem", fontWeight: 700, color: "#20C997" }}>AED</span>
              <input type="number" value={amountAED} onChange={(e) => setAmountAED(e.target.value)} placeholder="0.00" min="1" step="0.01" disabled={isPending} style={{ ...inputStyle, paddingLeft: "3.5rem" }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Payment Status *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {(["FULL", "PARTIAL"] as PaymentStatus[]).map((ps) => (
                <button
                  key={ps} type="button" onClick={() => setPaymentStatus(ps)} disabled={isPending}
                  style={{
                    padding: "0.75rem", borderRadius: 10, cursor: "pointer",
                    border: paymentStatus === ps ? `1.5px solid ${ps === "FULL" ? "#20C997" : "#fbbf24"}` : "1.5px solid rgba(255,255,255,0.1)",
                    background: paymentStatus === ps ? ps === "FULL" ? "rgba(32,201,151,0.1)" : "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.04)",
                    color: paymentStatus === ps ? ps === "FULL" ? "#20C997" : "#fbbf24" : "#8b8aa8",
                    fontWeight: 700, fontSize: "0.85rem", fontFamily: "inherit", transition: "all 0.15s"
                  }}
                >
                  {ps === "FULL" ? "✓ Full" : "◑ Partial"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: "0.6rem", borderRadius: 9, fontSize: "0.8rem", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", color: "#f87171" }}>
              ⚠ {error}
            </div>
          )}

          <button type="submit" disabled={isPending} style={{
            padding: "0.85rem", borderRadius: 12, border: "none", marginTop: "0.5rem",
            background: isPending ? "rgba(32,201,151,0.3)" : "linear-gradient(135deg,#159d74,#20C997)",
            color: "white", fontWeight: 800, fontSize: "0.95rem", fontFamily: "inherit",
            cursor: isPending ? "not-allowed" : "pointer", boxShadow: "0 4px 16px rgba(32,201,151,0.3)"
          }}>
            {isPending ? "Saving…" : "Confirm & Close Deal"}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#8b8aa8", marginBottom: "0.4rem" };
const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "0.7rem 0.9rem", color: "#f0f0ff", fontSize: "0.9rem", fontFamily: "inherit", outline: "none" };

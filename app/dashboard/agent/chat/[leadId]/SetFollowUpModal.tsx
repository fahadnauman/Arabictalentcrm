"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { createFollowUp } from "@/app/actions/followup";

interface SetFollowUpModalProps {
  leadId: string;
  leadName: string;
  onClose: () => void;
  onScheduled?: () => void;
}

export default function SetFollowUpModal({
  leadId,
  leadName,
  onClose,
  onScheduled,
}: SetFollowUpModalProps) {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTx] = useTransition();

  useEffect(() => {
    setMounted(true);
    // Default to tomorrow 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setPreset(hoursAhead: number, targetTime?: string) {
    const target = new Date();
    target.setHours(target.getHours() + hoursAhead);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const dd = String(target.getDate()).padStart(2, "0");
    setDate(`${yyyy}-${mm}-${dd}`);

    if (targetTime) {
      setTime(targetTime);
    } else {
      const hh = String(target.getHours()).padStart(2, "0");
      const mins = String(target.getMinutes()).padStart(2, "0");
      setTime(`${hh}:${mins}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!date) {
      setError("Please select a follow-up date.");
      return;
    }
    if (!time) {
      setError("Please select a follow-up time.");
      return;
    }
    if (!note.trim()) {
      setError("Please provide a note describing the follow-up purpose.");
      return;
    }

    const scheduledDateTime = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      setError("Invalid date or time selected.");
      return;
    }

    startTx(async () => {
      try {
        await createFollowUp({
          leadId,
          scheduledAt: scheduledDateTime.toISOString(),
          note: note.trim(),
        });
        if (onScheduled) onScheduled();
        onClose();
      } catch (err: any) {
        setError(err?.message || "Failed to schedule follow-up. Please try again.");
      }
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(5, 8, 18, 0.85)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 20,
          padding: "1.75rem",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(249, 115, 22, 0.12)",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(249, 115, 22, 0.15)",
                color: "#fb923c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.1rem",
                border: "1px solid rgba(249, 115, 22, 0.3)",
              }}
            >
              ⏰
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#f3f4f6" }}>
                Schedule Follow-Up
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#9ca3af" }}>
                Setting callback alert for <strong style={{ color: "#e5e7eb" }}>{leadName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#9ca3af",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.9rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Quick presets */}
        <div style={{ marginBottom: "1.25rem" }}>
          <span style={labelStyle}>Quick Presets</span>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
            <button
              type="button"
              onClick={() => setPreset(2)}
              style={presetBtnStyle}
            >
              +2 Hours
            </button>
            <button
              type="button"
              onClick={() => setPreset(24, "10:00")}
              style={presetBtnStyle}
            >
              Tomorrow 10 AM
            </button>
            <button
              type="button"
              onClick={() => setPreset(48, "11:00")}
              style={presetBtnStyle}
            >
              In 2 Days
            </button>
            <button
              type="button"
              onClick={() => setPreset(168, "10:00")}
              style={presetBtnStyle}
            >
              Next Week
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {/* Date and Time Row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Scheduled Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Scheduled Time *</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={isPending}
                style={inputStyle}
                required
              />
            </div>
          </div>

          {/* Follow-up Note */}
          <div>
            <label style={labelStyle}>Follow-Up Agenda / Note *</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Lead requested a callback to review conversational course schedule and installment options..."
              rows={3}
              disabled={isPending}
              style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
              required
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.65rem 0.85rem",
                borderRadius: 10,
                fontSize: "0.8rem",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                flex: 1,
                padding: "0.8rem",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.12)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "#d1d5db",
                fontWeight: 600,
                fontSize: "0.88rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                flex: 2,
                padding: "0.8rem",
                borderRadius: 12,
                border: "none",
                background: isPending
                  ? "rgba(249, 115, 22, 0.3)"
                  : "linear-gradient(135deg, #ea580c, #f97316)",
                color: "white",
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 18px rgba(249, 115, 22, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {isPending ? "Scheduling…" : "✓ Set Follow-Up"}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#9ca3af",
  marginBottom: "0.35rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: 10,
  padding: "0.65rem 0.85rem",
  color: "#f3f4f6",
  fontSize: "0.88rem",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const presetBtnStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#c4c3dc",
  fontSize: "0.72rem",
  fontWeight: 600,
  padding: "0.3rem 0.6rem",
  borderRadius: 8,
  cursor: "pointer",
};

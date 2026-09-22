"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { logFollowUpOutcome } from "@/app/actions/followup";

interface Props {
  leadId: string;
  leadName: string;
  activeFollowUpId?: string | null;
  onClose: () => void;
  onUpdated?: () => void;
}

const OUTCOME_PRESETS = [
  { label: "Callback Requested", icon: "📞", color: "#fb923c", defaultSchedule: true },
  { label: "Interested", icon: "⭐", color: "#20C997", defaultSchedule: true },
  { label: "Not Responding", icon: "📵", color: "#9ca3af", defaultSchedule: false },
  { label: "Demo Attended", icon: "🎓", color: "#c084fc", defaultSchedule: true },
  { label: "Thinking / Reviewing", icon: "💭", color: "#60a5fa", defaultSchedule: true },
];

export default function UpdateFollowUpModal({
  leadId,
  leadName,
  activeFollowUpId,
  onClose,
  onUpdated,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState(OUTCOME_PRESETS[0].label);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [shouldScheduleNext, setShouldScheduleNext] = useState(true);
  const [nextDate, setNextDate] = useState("");
  const [nextTime, setNextTime] = useState("11:00");
  const [priority, setPriority] = useState<"HIGH" | "MEDIUM" | "LOW">("MEDIUM");
  const [error, setError] = useState("");
  const [isPending, startTx] = useTransition();

  useEffect(() => {
    setMounted(true);
    // Default next date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setNextDate(`${yyyy}-${mm}-${dd}`);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSelectPreset(preset: typeof OUTCOME_PRESETS[0]) {
    setSelectedOutcome(preset.label);
    setShouldScheduleNext(preset.defaultSchedule);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!outcomeNote.trim()) {
      setError("Please enter details/notes regarding the outcome.");
      return;
    }

    let nextScheduledAt: string | null = null;
    if (shouldScheduleNext) {
      if (!nextDate || !nextTime) {
        setError("Please select both a date and time for the next follow-up.");
        return;
      }
      const combined = new Date(`${nextDate}T${nextTime}:00`);
      if (isNaN(combined.getTime())) {
        setError("Invalid date/time for next follow-up.");
        return;
      }
      nextScheduledAt = combined.toISOString();
    }

    startTx(async () => {
      try {
        await logFollowUpOutcome({
          leadId,
          followUpId: activeFollowUpId,
          outcomeStatus: selectedOutcome,
          outcomeNote: outcomeNote.trim(),
          nextScheduledAt,
          priority,
        });

        if (onUpdated) onUpdated();
        onClose();
      } catch (err: any) {
        setError(err?.message || "Failed to update follow-up outcome.");
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
        zIndex: 99999,
        background: "rgba(3, 6, 16, 0.88)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "linear-gradient(180deg, #0f1428 0%, #0a0e1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 20,
          padding: "1.5rem",
          animation: "scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "1.1rem" }}>📋</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f0f0ff" }}>
                Update Follow-Up Outcome
              </span>
            </div>
            <p style={{ fontSize: "0.78rem", color: "#8b8aa8", margin: 0 }}>
              Logging latest interaction for <strong style={{ color: "#c4c3dc" }}>{leadName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#8b8aa8",
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Prominent Message Lead Navigation Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.7rem 0.9rem",
            marginBottom: "1.2rem",
            background: "rgba(124, 58, 237, 0.12)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            borderRadius: 12,
            gap: "0.5rem",
          }}
        >
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
              Need to contact right now?
            </div>
            <div style={{ fontSize: "0.72rem", color: "#a78bfa" }}>
              Direct chat screen for {leadName}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/dashboard/agent/chat/${leadId}`);
            }}
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              border: "1px solid rgba(167, 139, 250, 0.4)",
              borderRadius: 8,
              padding: "0.45rem 0.85rem",
              color: "#ffffff",
              fontSize: "0.78rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              boxShadow: "0 2px 10px rgba(124, 58, 237, 0.4)",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Message Lead</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          {/* Outcome Status Presets */}
          <div>
            <label style={labelStyle}>Follow-Up Status / Outcome *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.45rem" }}>
              {OUTCOME_PRESETS.map((preset) => {
                const isSelected = selectedOutcome === preset.label;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    style={{
                      padding: "0.55rem 0.65rem",
                      borderRadius: 10,
                      border: isSelected
                        ? `1.5px solid ${preset.color}`
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isSelected ? `${preset.color}20` : "rgba(255, 255, 255, 0.03)",
                      color: isSelected ? preset.color : "#d1d5db",
                      fontSize: "0.76rem",
                      fontWeight: isSelected ? 800 : 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Outcome Note */}
          <div>
            <label style={labelStyle}>Outcome Notes & Context *</label>
            <textarea
              value={outcomeNote}
              onChange={(e) => setOutcomeNote(e.target.value)}
              placeholder="e.g. Called client, they were busy in meetings and requested to be called back tomorrow at 11 AM..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              disabled={isPending}
            />
          </div>

          {/* Schedule Next Follow-Up Checkbox */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              padding: "0.6rem 0.75rem",
              borderRadius: 10,
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <input
              type="checkbox"
              id="scheduleNext"
              checked={shouldScheduleNext}
              onChange={(e) => setShouldScheduleNext(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#20C997", cursor: "pointer" }}
            />
            <label
              htmlFor="scheduleNext"
              style={{ fontSize: "0.82rem", color: "#f0f0ff", fontWeight: 700, cursor: "pointer" }}
            >
              ⏰ Schedule Next Follow-Up
            </label>
          </div>

          {/* Next Follow-Up Details */}
          {shouldScheduleNext && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "0.85rem",
                borderRadius: 12,
                background: "rgba(32, 201, 151, 0.05)",
                border: "1px solid rgba(32, 201, 151, 0.2)",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={labelStyle}>Next Date *</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    style={inputStyle}
                    disabled={isPending}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Time *</label>
                  <input
                    type="time"
                    value={nextTime}
                    onChange={(e) => setNextTime(e.target.value)}
                    style={inputStyle}
                    disabled={isPending}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Priority</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((p) => {
                    const isP = priority === p;
                    const pColors = {
                      HIGH: "#ef4444",
                      MEDIUM: "#f59e0b",
                      LOW: "#60a5fa",
                    };
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        style={{
                          padding: "0.4rem",
                          borderRadius: 8,
                          border: isP ? `1.5px solid ${pColors[p]}` : "1px solid rgba(255,255,255,0.08)",
                          background: isP ? `${pColors[p]}25` : "transparent",
                          color: isP ? pColors[p] : "#8b8aa8",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "0.6rem",
                borderRadius: 9,
                fontSize: "0.8rem",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.3)",
                color: "#f87171",
              }}
            >
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "0.85rem",
              borderRadius: 12,
              border: "none",
              marginTop: "0.25rem",
              background: isPending
                ? "rgba(32, 201, 151, 0.3)"
                : "linear-gradient(135deg, #159d74, #20C997)",
              color: "white",
              fontWeight: 800,
              fontSize: "0.95rem",
              fontFamily: "inherit",
              cursor: isPending ? "not-allowed" : "pointer",
              boxShadow: "0 4px 16px rgba(32, 201, 151, 0.3)",
            }}
          >
            {isPending ? "Saving Outcome…" : "✓ Save Follow-Up Outcome"}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
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
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "#8b8aa8",
  marginBottom: "0.4rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  padding: "0.65rem 0.85rem",
  color: "#f0f0ff",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  outline: "none",
};

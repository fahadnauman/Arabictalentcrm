"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { resolveOverdueTask } from "@/app/actions/task";
import { resolveOverdueFollowUp } from "@/app/actions/followup";

interface OverdueResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: (item: any) => void;
  item: {
    id: string;
    type: "TASK" | "FOLLOWUP";
    title?: string | null;
    message?: string;
    dueDate?: string | Date | null;
  } | null;
}

export default function OverdueResolutionModal({
  isOpen,
  onClose,
  onResolved,
  item,
}: OverdueResolutionModalProps) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState("");
  const [countermeasure, setCountermeasure] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTx] = useTransition();

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !isOpen || !item) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a meaningful reason for delay (min 5 characters).");
      return;
    }

    if (!countermeasure.trim() || countermeasure.trim().length < 5) {
      setError("Please document the corrective countermeasure taken (min 5 characters).");
      return;
    }

    const targetItem = item;
    if (!targetItem) return;

    startTx(async () => {
      try {
        if (targetItem.type === "TASK") {
          const res = await resolveOverdueTask({
            taskId: targetItem.id,
            overdueReason: reason.trim(),
            countermeasure: countermeasure.trim(),
          });
          onResolved(res.task);
        } else {
          const res = await resolveOverdueFollowUp({
            followUpId: targetItem.id,
            overdueReason: reason.trim(),
            countermeasure: countermeasure.trim(),
          });
          onResolved(res.followUp);
        }
        onClose();
      } catch (err: any) {
        setError(err?.message || "Failed to resolve overdue item.");
      }
    });
  }

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(10, 4, 8, 0.92)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #1c0f14 0%, #0d070a 100%)",
          border: "2px solid #ef4444",
          borderRadius: 20,
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(239, 68, 68, 0.25), 0 0 40px rgba(0,0,0,0.8)",
          animation: "scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Warning Banner Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1.5px solid rgba(239, 68, 68, 0.4)",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.3rem",
              flexShrink: 0,
            }}
          >
            ⚠️
          </div>
          <div>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 800,
                color: "#f87171",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Strict Accountability Audit
            </span>
            <h2 style={{ margin: "0.15rem 0 0.35rem", fontSize: "1.2rem", fontWeight: 800, color: "#fef2f2" }}>
              Overdue Item Completion
            </h2>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#d1d5db" }}>
              This item was not completed by its scheduled deadline. To complete it, administrative policy mandates documenting the delay reason and corrective countermeasure.
            </p>
          </div>
        </div>

        {/* Item context card */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 12,
            padding: "0.75rem 0.9rem",
            marginBottom: "1.25rem",
          }}
        >
          {item.title && (
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f87171", marginBottom: "0.2rem" }}>
              {item.title}
            </div>
          )}
          {item.message && (
            <div style={{ fontSize: "0.8rem", color: "#e5e7eb", lineHeight: 1.4 }}>
              {item.message}
            </div>
          )}
          {item.dueDate && (
            <div style={{ fontSize: "0.72rem", color: "#fb923c", marginTop: "0.4rem", fontWeight: 600 }}>
              Scheduled Deadline: {new Date(item.dueDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <label style={labelStyle}>
              1. Reason for Delay? *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the specific root cause or bottleneck that prevented timely completion..."
              rows={3}
              style={textareaStyle}
              disabled={isPending}
            />
          </div>

          <div>
            <label style={labelStyle}>
              2. Countermeasure Taken? *
            </label>
            <textarea
              value={countermeasure}
              onChange={(e) => setCountermeasure(e.target.value)}
              placeholder="What immediate adjustment or operational fix was made to resolve this and prevent recurrence?..."
              rows={3}
              style={textareaStyle}
              disabled={isPending}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "0.65rem",
                borderRadius: 10,
                fontSize: "0.8rem",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                color: "#fca5a5",
              }}
            >
              ⚠ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: 12,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "transparent",
                color: "#9ca3af",
                fontWeight: 700,
                fontSize: "0.85rem",
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
                padding: "0.75rem",
                borderRadius: 12,
                border: "none",
                background: isPending ? "rgba(239, 68, 68, 0.4)" : "linear-gradient(135deg, #dc2626, #ef4444)",
                color: "white",
                fontWeight: 800,
                fontSize: "0.88rem",
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px rgba(239, 68, 68, 0.4)",
              }}
            >
              {isPending ? "Logging to Audit Trail…" : "Submit & Complete Item"}
            </button>
          </div>
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
  fontSize: "0.75rem",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#f87171",
  marginBottom: "0.45rem",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  borderRadius: 10,
  padding: "0.65rem 0.85rem",
  color: "#fef2f2",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
};

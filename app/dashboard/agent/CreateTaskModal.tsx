"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { createTask } from "@/app/actions/task";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (newTask: any) => void;
  agentId: string;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
  agentId,
}: CreateTaskModalProps) {
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("17:00");
  const [error, setError] = useState("");
  const [isPending, startTx] = useTransition();

  useEffect(() => {
    setMounted(true);
    // Default dueDate to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setDueDate(`${yyyy}-${mm}-${dd}`);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted || !isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Task description cannot be empty.");
      return;
    }

    let finalDueDate: string | undefined = undefined;
    if (dueDate) {
      finalDueDate = `${dueDate}T${dueTime || "12:00"}:00`;
    }

    startTx(async () => {
      try {
        const res = await createTask({
          title: title.trim() || undefined,
          message: message.trim(),
          priority,
          dueDate: finalDueDate,
          receiverId: agentId,
        });

        if (res.success && res.task) {
          onCreated(res.task);
          setTitle("");
          setMessage("");
          onClose();
        }
      } catch (err: any) {
        setError(err?.message || "Failed to create task. Please try again.");
      }
    });
  }

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
          maxWidth: 460,
          background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 20,
          padding: "1.75rem",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(32, 201, 151, 0.1)",
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
            paddingBottom: "0.85rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "1.2rem" }}>📝</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#f3f4f6" }}>
                Create Personal Task
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "#9ca3af" }}>
                Self-assigned action item & daily goal
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
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>Task Title (Optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Call Evening Demo Attendees"
              disabled={isPending}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Task Details / Action Item *</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Follow up with 5 hot leads regarding weekend batch registration..."
              rows={3}
              disabled={isPending}
              style={{ ...inputStyle, resize: "vertical", minHeight: "75px" }}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Priority Level</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
              {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((p) => {
                const isSelected = priority === p;
                const colors: Record<string, string> = {
                  LOW: "#94a3b8",
                  MEDIUM: "#60a5fa",
                  HIGH: "#f59e0b",
                  URGENT: "#ef4444",
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      padding: "0.45rem 0.2rem",
                      borderRadius: 8,
                      border: isSelected
                        ? `1.5px solid ${colors[p]}`
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      background: isSelected
                        ? `${colors[p]}25`
                        : "rgba(255, 255, 255, 0.03)",
                      color: isSelected ? colors[p] : "#9ca3af",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isPending}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Due Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={isPending}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                fontSize: "0.8rem",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
              }}
            >
              ⚠ {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: 10,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "#d1d5db",
                fontWeight: 600,
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
                borderRadius: 10,
                border: "none",
                background: isPending
                  ? "rgba(32, 201, 151, 0.3)"
                  : "linear-gradient(135deg, #059669, #20C997)",
                color: "white",
                fontWeight: 700,
                fontSize: "0.88rem",
                cursor: isPending ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px rgba(32, 201, 151, 0.3)",
              }}
            >
              {isPending ? "Creating…" : "✓ Add To My Tasks"}
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
  padding: "0.6rem 0.8rem",
  color: "#f3f4f6",
  fontSize: "0.88rem",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

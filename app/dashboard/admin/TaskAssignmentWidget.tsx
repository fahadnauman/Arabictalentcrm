"use client";

import { useState, useTransition } from "react";
import { createTask } from "@/app/actions/task";
import { useRouter } from "next/navigation";

interface AgentOption {
  id: string;
  name: string;
  email: string;
}

interface TaskItem {
  id: string;
  title: string | null;
  message: string;
  priority: string;
  status: string;
  isBroadcast: boolean;
  receiverName: string;
  senderName: string;
  createdAt: string | Date;
}

interface TaskAssignmentWidgetProps {
  agents: AgentOption[];
  recentTasks: TaskItem[];
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  LOW:    { bg: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" },
  MEDIUM: { bg: "rgba(59, 130, 246, 0.15)",  color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
  HIGH:   { bg: "rgba(245, 158, 11, 0.15)",  color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
  URGENT: { bg: "rgba(239, 68, 68, 0.15)",   color: "#ef4444", border: "rgba(239, 68, 68, 0.3)" },
};

export default function TaskAssignmentWidget({ agents, recentTasks }: TaskAssignmentWidgetProps) {
  const router = useRouter();
  const [isPending, startTx] = useTransition();

  const [message, setMessage] = useState("");
  const [receiverId, setReceiverId] = useState("ALL");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!message.trim()) {
      setError("Please type a message/task.");
      return;
    }

    startTx(async () => {
      try {
        await createTask({
          message: message.trim(),
          receiverId,
          priority,
        });

        setMessage("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to assign task.");
      }
    });
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(20, 24, 39, 0.7) 0%, rgba(10, 14, 26, 0.7) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.2rem",
          paddingBottom: "0.8rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#6366f1",
              boxShadow: "0 0 10px #6366f1",
              display: "inline-block",
            }}
          />
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f1f0ff", fontWeight: 700 }}>
            Task Assignment & Directives
          </h3>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>
          Internal Dispatch
        </span>
      </div>

      <form onSubmit={handleSend}>
        {error && (
          <div
            style={{
              background: "rgba(248, 113, 113, 0.15)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              borderRadius: "8px",
              padding: "0.6rem 0.8rem",
              color: "#f87171",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: "rgba(32, 201, 151, 0.15)",
              border: "1px solid rgba(32, 201, 151, 0.3)",
              borderRadius: "8px",
              padding: "0.6rem 0.8rem",
              color: "#20C997",
              fontSize: "0.85rem",
              marginBottom: "1rem",
            }}
          >
            ✓ Directive dispatched successfully!
          </div>
        )}

        <div style={{ marginBottom: "1rem" }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type directive, reminder, or priority instruction..."
            rows={3}
            style={{
              width: "100%",
              padding: "0.75rem",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "10px",
              color: "#f1f0ff",
              fontSize: "0.88rem",
              outline: "none",
              resize: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr auto",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "#0d1322",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                color: "#f1f0ff",
                fontSize: "0.82rem",
                outline: "none",
              }}
            >
              <option value="ALL">📢 Broadcast to All Agents</option>
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  👤 {ag.name} ({ag.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              style={{
                width: "100%",
                padding: "0.6rem 0.8rem",
                background: "#0d1322",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                color: "#f1f0ff",
                fontSize: "0.82rem",
                outline: "none",
              }}
            >
              <option value="LOW">⚪ Low Priority</option>
              <option value="MEDIUM">🔵 Medium Priority</option>
              <option value="HIGH">🟠 High Priority</option>
              <option value="URGENT">🔴 Urgent Priority</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "0.6rem 1.25rem",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              border: "none",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {isPending ? "Sending..." : "Dispatch Task"}
          </button>
        </div>
      </form>

      {/* Recent Dispatches list */}
      {recentTasks.length > 0 && (
        <div style={{ marginTop: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#8b8aa8",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.75rem",
              fontWeight: 700,
            }}
          >
            Recent Dispatches
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "180px", overflowY: "auto" }}>
            {recentTasks.slice(0, 5).map((t) => {
              const pStyle = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.MEDIUM;
              const isCompleted = t.status === "COMPLETED";

              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.8rem",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        padding: "0.15rem 0.45rem",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        background: pStyle.bg,
                        color: pStyle.color,
                        border: `1px solid ${pStyle.border}`,
                      }}
                    >
                      {t.priority}
                    </span>
                    <span
                      style={{
                        color: "#f1f0ff",
                        fontSize: "0.82rem",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "260px",
                        textDecoration: isCompleted ? "line-through" : "none",
                        opacity: isCompleted ? 0.6 : 1,
                      }}
                    >
                      {t.message}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
                    <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>
                      → {t.receiverName}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.45rem",
                        borderRadius: "99px",
                        background: isCompleted ? "rgba(32, 201, 151, 0.15)" : "rgba(255, 255, 255, 0.05)",
                        color: isCompleted ? "#20C997" : "#8b8aa8",
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

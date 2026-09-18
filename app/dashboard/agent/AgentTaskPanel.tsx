"use client";

import { useState, useTransition } from "react";
import { updateTaskStatus } from "@/app/actions/task";
import { useRouter } from "next/navigation";

interface Task {
  id: string;
  title: string | null;
  message: string;
  priority: string;
  status: string;
  isBroadcast: boolean;
  senderName: string;
  createdAt: string | Date;
  completedAt: string | Date | null;
}

interface AgentTaskPanelProps {
  initialTasks: Task[];
  agentId: string;
}

const PRIORITY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW:    { label: "Low",    color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.2)" },
  MEDIUM: { label: "Medium", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)",  border: "rgba(96, 165, 250, 0.2)" },
  HIGH:   { label: "High",   color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  URGENT: { label: "URGENT", color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)",  border: "rgba(239, 68, 68, 0.4)" },
};

function formatTimeAgo(d: string | Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(d).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AgentTaskPanel({ initialTasks, agentId }: AgentTaskPanelProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isPending, startTx] = useTransition();

  const pendingCount = tasks.filter((t) => t.status !== "COMPLETED").length;

  async function handleToggleStatus(task: Task) {
    const nextStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, status: nextStatus, completedAt: nextStatus === "COMPLETED" ? new Date() : null }
          : t
      )
    );

    startTx(async () => {
      try {
        await updateTaskStatus(task.id, nextStatus as any);
        router.refresh();
      } catch (err) {
        console.error("Failed to update status:", err);
        // Rollback
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
      }
    });
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #111827 0%, #0c101c 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "1.25rem",
        marginTop: "1.5rem",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>📋</span>
          <span style={{ color: "#f1f0ff", fontWeight: 700, fontSize: "0.95rem" }}>
            Directives & Tasks
          </span>
          {pendingCount > 0 ? (
            <span
              style={{
                background: "rgba(239, 68, 68, 0.2)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: "0.7rem",
                fontWeight: 800,
                padding: "0.15rem 0.5rem",
                borderRadius: "99px",
              }}
            >
              {pendingCount} Pending
            </span>
          ) : (
            <span
              style={{
                background: "rgba(32, 201, 151, 0.1)",
                color: "#20C997",
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "0.15rem 0.5rem",
                borderRadius: "99px",
              }}
            >
              All Done
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>From Management</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {tasks.length === 0 ? (
          <div style={{ color: "#8b8aa8", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
            No active directives assigned to you right now.
          </div>
        ) : (
          tasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "10px",
                  background: isCompleted ? "rgba(255, 255, 255, 0.01)" : "rgba(255, 255, 255, 0.03)",
                  border: isCompleted
                    ? "1px solid rgba(255, 255, 255, 0.04)"
                    : `1px solid ${task.priority === "URGENT" ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
                  transition: "all 0.2s ease",
                  opacity: isCompleted ? 0.6 : 1,
                }}
              >
                {/* Status Toggle Checkbox */}
                <input
                  type="checkbox"
                  checked={isCompleted}
                  onChange={() => handleToggleStatus(task)}
                  style={{
                    width: "18px",
                    height: "18px",
                    marginTop: "2px",
                    accentColor: "#20C997",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  title={isCompleted ? "Mark incomplete" : "Mark completed"}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        color: pMeta.color,
                        background: pMeta.bg,
                        border: `1px solid ${pMeta.border}`,
                      }}
                    >
                      {pMeta.label}
                    </span>
                    {task.isBroadcast && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "#60a5fa",
                          background: "rgba(96, 165, 250, 0.1)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                        }}
                      >
                        📢 All Agents
                      </span>
                    )}
                    <span style={{ fontSize: "0.72rem", color: "#8b8aa8", marginLeft: "auto" }}>
                      {formatTimeAgo(task.createdAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      color: isCompleted ? "#8b8aa8" : "#f1f0ff",
                      fontSize: "0.85rem",
                      lineHeight: "1.4",
                      textDecoration: isCompleted ? "line-through" : "none",
                    }}
                  >
                    {task.message}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

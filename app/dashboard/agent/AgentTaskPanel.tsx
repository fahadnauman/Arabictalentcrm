"use client";

import { useState, useTransition, useMemo } from "react";
import { updateTaskStatus } from "@/app/actions/task";
import { useRouter } from "next/navigation";
import CreateTaskModal from "./CreateTaskModal";
import OverdueResolutionModal from "./OverdueResolutionModal";
import UpcomingTasksCalendarModal from "./UpcomingTasksCalendarModal";
import UpdateFollowUpModal from "./chat/[leadId]/UpdateFollowUpModal";

export interface Task {
  id: string;
  title: string | null;
  message: string;
  priority: string;
  status: string;
  isBroadcast: boolean;
  senderName: string;
  dueDate?: string | Date | null;
  createdAt: string | Date;
  completedAt: string | Date | null;
  overdueReason?: string | null;
  countermeasure?: string | null;
}

export interface FollowUpItem {
  id: string;
  leadId: string;
  scheduledAt: string | Date;
  note: string;
  priority?: string;
  status: string;
  lead: {
    id: string;
    name: string;
    phone: string;
    company?: string | null;
    status?: string;
  };
}

interface AgentTaskPanelProps {
  initialTasks: Task[];
  initialFollowUps?: FollowUpItem[];
  agentId: string;
}

const PRIORITY_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  LOW:    { label: "Low",    color: "#94a3b8", bg: "rgba(148, 163, 184, 0.1)", border: "rgba(148, 163, 184, 0.2)" },
  MEDIUM: { label: "Medium", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.1)",  border: "rgba(96, 165, 250, 0.2)" },
  HIGH:   { label: "High",   color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.3)" },
  URGENT: { label: "URGENT", color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)",  border: "rgba(239, 68, 68, 0.4)" },
};

function getCountdownTag(dueDate?: string | Date | null, isCompleted?: boolean) {
  if (!dueDate || isCompleted) return null;
  const now = new Date().getTime();
  const target = new Date(dueDate).getTime();
  const diffMs = target - now;

  if (diffMs < 0) {
    const absDiff = Math.abs(diffMs);
    const mins = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 60) return { text: `Overdue by ${mins}m`, isOverdue: true };
    if (hours < 24) return { text: `Overdue by ${hours}h`, isOverdue: true };
    return { text: `Overdue by ${days}d`, isOverdue: true };
  }

  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 60) return { text: `Incoming in ${mins} mins`, isOverdue: false };
  if (hours < 24) return { text: `Incoming in ${hours} hours`, isOverdue: false };
  if (days === 1) return { text: `1 day to go`, isOverdue: false };
  return { text: `${days} days to go`, isOverdue: false };
}

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

export default function AgentTaskPanel({ initialTasks, initialFollowUps = [], agentId }: AgentTaskPanelProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(initialFollowUps);
  const [activeTab, setActiveTab] = useState<"ALL" | "TASKS" | "FOLLOWUPS">("ALL");
  const [activeFollowUpToUpdate, setActiveFollowUpToUpdate] = useState<FollowUpItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [overdueItemToResolve, setOverdueItemToResolve] = useState<any | null>(null);
  const [prioritySort, setPrioritySort] = useState<"HIGH_FIRST" | "DATE_ORDER">("HIGH_FIRST");
  const [isPending, startTx] = useTransition();

  const pendingCount = tasks.filter((t) => t.status !== "COMPLETED").length;
  const pendingFollowUpsCount = followUps.filter((f) => f.status === "PENDING").length;

  // Priority sorting for tasks
  const sortedTasks = useMemo(() => {
    if (prioritySort === "DATE_ORDER") {
      return [...tasks].sort((a, b) => {
        const dA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const dB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        return dA - dB;
      });
    }

    const pWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    return [...tasks].sort((a, b) => {
      // Completed items go to the bottom
      if (a.status === "COMPLETED" && b.status !== "COMPLETED") return 1;
      if (b.status === "COMPLETED" && a.status !== "COMPLETED") return -1;

      const wA = pWeight[a.priority] || 1;
      const wB = pWeight[b.priority] || 1;
      if (wB !== wA) return wB - wA;

      const dA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
      const dB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
      return dA - dB;
    });
  }, [tasks, prioritySort]);

  // Sorting for follow-ups
  const sortedFollowUps = useMemo(() => {
    return [...followUps].sort((a, b) => {
      const dA = new Date(a.scheduledAt).getTime();
      const dB = new Date(b.scheduledAt).getTime();
      return dA - dB;
    });
  }, [followUps]);

  async function handleToggleStatus(task: Task) {
    const isOverdue =
      task.status !== "COMPLETED" &&
      task.dueDate != null &&
      new Date(task.dueDate).getTime() < new Date().getTime();

    // Strict Accountability: If overdue, force delay reason & countermeasure modal
    if (isOverdue) {
      setOverdueItemToResolve({
        id: task.id,
        type: "TASK",
        title: task.title,
        message: task.message,
        dueDate: task.dueDate,
      });
      return;
    }

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
          flexWrap: "wrap",
          gap: "0.6rem",
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

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          {/* Priority sorting toggle */}
          <button
            type="button"
            onClick={() => setPrioritySort(prioritySort === "HIGH_FIRST" ? "DATE_ORDER" : "HIGH_FIRST")}
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: prioritySort === "HIGH_FIRST" ? "#f59e0b" : "#d1d5db",
              fontSize: "0.72rem",
              fontWeight: 700,
              padding: "0.25rem 0.6rem",
              borderRadius: "6px",
              cursor: "pointer",
            }}
            title="Toggle priority vs date sorting"
          >
            ⚡ {prioritySort === "HIGH_FIRST" ? "Priority: High ➔ Low" : "Due Date Order"}
          </button>

          {/* View More Calendar Filter Button */}
          <button
            type="button"
            onClick={() => setIsCalendarModalOpen(true)}
            style={{
              background: "rgba(96, 165, 250, 0.12)",
              border: "1px solid rgba(96, 165, 250, 0.35)",
              color: "#60a5fa",
              fontSize: "0.74rem",
              fontWeight: 700,
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            📅 View More
          </button>

          {/* Create Task Button */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              background: "rgba(32, 201, 151, 0.12)",
              border: "1px solid rgba(32, 201, 151, 0.35)",
              color: "#20C997",
              fontSize: "0.74rem",
              fontWeight: 700,
              padding: "0.25rem 0.6rem",
              borderRadius: "6px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              transition: "all 0.15s ease",
            }}
          >
            + Create Task
          </button>
        </div>
      </div>

      {/* ── Filter Tabs: All, Directives, Follow-Ups ─────────────── */}
      <div style={{ display: "flex", gap: "0.45rem", marginBottom: "0.95rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "8px",
            fontSize: "0.76rem",
            fontWeight: 700,
            border: activeTab === "ALL" ? "1px solid #20C997" : "1px solid rgba(255,255,255,0.08)",
            background: activeTab === "ALL" ? "rgba(32, 201, 151, 0.15)" : "rgba(255,255,255,0.03)",
            color: activeTab === "ALL" ? "#20C997" : "#8b8aa8",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          All ({pendingCount + pendingFollowUpsCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("TASKS")}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "8px",
            fontSize: "0.76rem",
            fontWeight: 700,
            border: activeTab === "TASKS" ? "1px solid #60a5fa" : "1px solid rgba(255,255,255,0.08)",
            background: activeTab === "TASKS" ? "rgba(96, 165, 250, 0.15)" : "rgba(255,255,255,0.03)",
            color: activeTab === "TASKS" ? "#60a5fa" : "#8b8aa8",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          📋 Directives ({pendingCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("FOLLOWUPS")}
          style={{
            padding: "0.35rem 0.75rem",
            borderRadius: "8px",
            fontSize: "0.76rem",
            fontWeight: 700,
            border: activeTab === "FOLLOWUPS" ? "1px solid #fb923c" : "1px solid rgba(255,255,255,0.08)",
            background: activeTab === "FOLLOWUPS" ? "rgba(251, 146, 60, 0.15)" : "rgba(255,255,255,0.03)",
            color: activeTab === "FOLLOWUPS" ? "#fb923c" : "#8b8aa8",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          ⏰ Follow-Ups ({pendingFollowUpsCount})
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {/* ── Follow-Up Cards ───────────────────────────────────── */}
        {(activeTab === "ALL" || activeTab === "FOLLOWUPS") &&
          sortedFollowUps.map((fu) => {
            const isCompleted = fu.status === "COMPLETED";
            const countdown = getCountdownTag(fu.scheduledAt, isCompleted);
            const isOverdue = countdown?.isOverdue ?? false;
            const pMeta = PRIORITY_META[fu.priority || "MEDIUM"] || PRIORITY_META.MEDIUM;

            return (
              <div
                key={`fu-${fu.id}`}
                onClick={() => setActiveFollowUpToUpdate(fu)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.8rem 0.95rem",
                  borderRadius: "10px",
                  background: isCompleted
                    ? "rgba(255, 255, 255, 0.01)"
                    : isOverdue
                    ? "rgba(239, 68, 68, 0.06)"
                    : "rgba(251, 146, 60, 0.05)",
                  border: isCompleted
                    ? "1px solid rgba(255, 255, 255, 0.04)"
                    : isOverdue
                    ? "2px solid #ef4444"
                    : "1px solid rgba(251, 146, 60, 0.25)",
                  boxShadow: isOverdue ? "0 0 16px rgba(239, 68, 68, 0.22)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  opacity: isCompleted ? 0.6 : 1,
                }}
              >
                {/* Follow-Up Clock Icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: isCompleted ? "rgba(255,255,255,0.05)" : "rgba(251, 146, 60, 0.15)",
                    border: isCompleted ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(251, 146, 60, 0.35)",
                    color: isCompleted ? "#8b8aa8" : "#fb923c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                  title="Scheduled Follow-Up"
                >
                  ⏰
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                      marginBottom: "0.25rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.9rem",
                        color: isCompleted ? "#8b8aa8" : "#f1f0ff",
                      }}
                    >
                      {fu.lead?.name || "Lead"}
                    </span>

                    {fu.lead?.phone && (
                      <span style={{ fontSize: "0.72rem", color: "#8b8aa8" }}>
                        {fu.lead.phone}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: "#fb923c",
                        background: "rgba(251, 146, 60, 0.1)",
                        border: "1px solid rgba(251, 146, 60, 0.25)",
                        padding: "0.08rem 0.4rem",
                        borderRadius: "4px",
                      }}
                    >
                      Follow-Up
                    </span>

                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: pMeta.color,
                        background: pMeta.bg,
                        border: `1px solid ${pMeta.border}`,
                        padding: "0.08rem 0.4rem",
                        borderRadius: "4px",
                      }}
                    >
                      {pMeta.label}
                    </span>

                    {countdown && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "4px",
                          background: countdown.isOverdue
                            ? "rgba(239, 68, 68, 0.2)"
                            : "rgba(251, 146, 60, 0.15)",
                          border: countdown.isOverdue
                            ? "1px solid rgba(239, 68, 68, 0.4)"
                            : "1px solid rgba(251, 146, 60, 0.35)",
                          color: countdown.isOverdue ? "#f87171" : "#fb923c",
                        }}
                      >
                        ⏳ {countdown.text}
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "#fb923c",
                        marginLeft: "auto",
                        fontWeight: 600,
                      }}
                    >
                      {new Date(fu.scheduledAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div
                    style={{
                      color: isCompleted ? "#8b8aa8" : "#d1d5db",
                      fontSize: "0.82rem",
                      lineHeight: "1.4",
                    }}
                  >
                    {fu.note}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveFollowUpToUpdate(fu);
                      }}
                      style={{
                        padding: "0.25rem 0.65rem",
                        borderRadius: "6px",
                        background: "rgba(251, 146, 60, 0.12)",
                        border: "1px solid rgba(251, 146, 60, 0.35)",
                        color: "#fb923c",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✓ Update Outcome
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/agent/chat/${fu.lead.id}`);
                      }}
                      style={{
                        padding: "0.25rem 0.65rem",
                        borderRadius: "6px",
                        background: "rgba(124, 58, 237, 0.15)",
                        border: "1px solid rgba(124, 58, 237, 0.35)",
                        color: "#c4b5fd",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      💬 Message Lead
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

        {/* ── Directive Tasks ───────────────────────────────────── */}
        {(activeTab === "ALL" || activeTab === "TASKS") && (
          sortedTasks.length === 0 && activeTab === "TASKS" ? (
            <div style={{ color: "#8b8aa8", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
              No active directives assigned to you right now. Click &quot;+ Create Task&quot; to add one.
            </div>
          ) : (
            sortedTasks.map((task) => {
            const isCompleted = task.status === "COMPLETED";
            const pMeta = PRIORITY_META[task.priority] || PRIORITY_META.MEDIUM;
            const countdown = getCountdownTag(task.dueDate, isCompleted);
            const isOverdue = countdown?.isOverdue ?? false;

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem 0.9rem",
                  borderRadius: "10px",
                  background: isCompleted
                    ? "rgba(255, 255, 255, 0.01)"
                    : isOverdue
                    ? "rgba(239, 68, 68, 0.05)"
                    : "rgba(255, 255, 255, 0.03)",
                  border: isCompleted
                    ? "1px solid rgba(255, 255, 255, 0.04)"
                    : isOverdue
                    ? "2px solid #ef4444" // Strict solid red outline for overdue
                    : `1px solid ${task.priority === "URGENT" ? "rgba(239, 68, 68, 0.3)" : "rgba(255, 255, 255, 0.08)"}`,
                  boxShadow: isOverdue ? "0 0 16px rgba(239, 68, 68, 0.22)" : "none",
                  transition: "all 0.2s ease",
                  opacity: isCompleted ? 0.6 : 1,
                }}
              >
                {/* Status Toggle Checkbox */}
                <button
                  onClick={() => handleToggleStatus(task)}
                  disabled={isPending}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: isCompleted
                      ? "1.5px solid #20C997"
                      : isOverdue
                      ? "1.5px solid #ef4444"
                      : "1.5px solid rgba(255, 255, 255, 0.3)",
                    background: isCompleted
                      ? "rgba(32, 201, 151, 0.2)"
                      : isOverdue
                      ? "rgba(239, 68, 68, 0.15)"
                      : "transparent",
                    color: isCompleted ? "#20C997" : isOverdue ? "#ef4444" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                  title={isCompleted ? "Mark as pending" : isOverdue ? "Resolve overdue directive" : "Mark as completed"}
                >
                  {isCompleted ? "✓" : isOverdue ? "!" : ""}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.25rem",
                      flexWrap: "wrap",
                    }}
                  >
                    {task.title && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.88rem",
                          color: isCompleted ? "#8b8aa8" : isOverdue ? "#fca5a5" : "#f1f0ff",
                          textDecoration: isCompleted ? "line-through" : "none",
                        }}
                      >
                        {task.title}
                      </span>
                    )}

                    {/* Priority Tag */}
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        color: pMeta.color,
                        background: pMeta.bg,
                        border: `1px solid ${pMeta.border}`,
                        padding: "0.1rem 0.45rem",
                        borderRadius: "4px",
                      }}
                    >
                      {pMeta.label}
                    </span>

                    {/* Countdown Tag */}
                    {countdown && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "0.1rem 0.45rem",
                          borderRadius: "4px",
                          background: countdown.isOverdue ? "rgba(239, 68, 68, 0.2)" : "rgba(32, 201, 151, 0.12)",
                          border: countdown.isOverdue ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(32, 201, 151, 0.3)",
                          color: countdown.isOverdue ? "#f87171" : "#20C997",
                        }}
                      >
                        ⏳ {countdown.text}
                      </span>
                    )}

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

                    {task.dueDate && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#fb923c",
                          background: "rgba(249, 115, 22, 0.1)",
                          border: "1px solid rgba(249, 115, 22, 0.25)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "4px",
                        }}
                      >
                        ⏰ Due: {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
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

                  {/* Overdue delay and countermeasure accountability display */}
                  {task.overdueReason && (
                    <div
                      style={{
                        marginTop: "0.45rem",
                        padding: "0.4rem 0.6rem",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        fontSize: "0.72rem",
                        color: "#9ca3af",
                      }}
                    >
                      <div><strong style={{ color: "#f87171" }}>Delay Reason:</strong> {task.overdueReason}</div>
                      {task.countermeasure && (
                        <div style={{ marginTop: "0.15rem" }}><strong style={{ color: "#20C997" }}>Countermeasure:</strong> {task.countermeasure}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ))}

        {/* Empty State for All */}
        {activeTab === "ALL" && sortedTasks.length === 0 && sortedFollowUps.length === 0 && (
          <div style={{ color: "#8b8aa8", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
            No active directives or follow-ups right now. All caught up!
          </div>
        )}

        {/* Empty State for Follow-Ups */}
        {activeTab === "FOLLOWUPS" && sortedFollowUps.length === 0 && (
          <div style={{ color: "#8b8aa8", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" }}>
            No pending follow-ups scheduled. Good job!
          </div>
        )}
      </div>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(newTask) => setTasks((prev) => [newTask, ...prev])}
        agentId={agentId}
      />

      <UpcomingTasksCalendarModal
        isOpen={isCalendarModalOpen}
        onClose={() => setIsCalendarModalOpen(false)}
        agentId={agentId}
      />

      {overdueItemToResolve && (
        <OverdueResolutionModal
          isOpen={true}
          item={overdueItemToResolve}
          onClose={() => setOverdueItemToResolve(null)}
          onResolved={(updated) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, status: "COMPLETED", overdueReason: updated.overdueReason, countermeasure: updated.countermeasure } : t))
            );
          }}
        />
      )}

      {/* Interactive Update Follow-Up Outcome Modal */}
      {activeFollowUpToUpdate && (
        <UpdateFollowUpModal
          leadId={activeFollowUpToUpdate.lead.id}
          leadName={activeFollowUpToUpdate.lead.name}
          activeFollowUpId={activeFollowUpToUpdate.id}
          onClose={() => setActiveFollowUpToUpdate(null)}
          onUpdated={() => {
            setFollowUps((prev) =>
              prev.filter((f) => f.id !== activeFollowUpToUpdate.id)
            );
            setActiveFollowUpToUpdate(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

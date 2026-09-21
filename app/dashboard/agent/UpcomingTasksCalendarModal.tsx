"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getAgentCalendarTasks, updateTaskStatus } from "@/app/actions/task";
import OverdueResolutionModal from "./OverdueResolutionModal";

interface Task {
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

interface UpcomingTasksCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
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
    // Overdue
    const absDiff = Math.abs(diffMs);
    const mins = Math.floor(absDiff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 60) return { text: `⚠️ Overdue by ${mins}m`, isOverdue: true };
    if (hours < 24) return { text: `⚠️ Overdue by ${hours}h`, isOverdue: true };
    return { text: `⚠️ Overdue by ${days}d`, isOverdue: true };
  }

  // Future
  const mins = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 60) return { text: `Incoming in ${mins} mins`, isOverdue: false };
  if (hours < 24) return { text: `Incoming in ${hours} hours`, isOverdue: false };
  if (days === 1) return { text: `1 day to go`, isOverdue: false };
  return { text: `${days} days to go`, isOverdue: false };
}

type FilterTab = "ALL" | "TODAY" | "WEEK" | "MONTH" | "OVERDUE";

export default function UpcomingTasksCalendarModal({
  isOpen,
  onClose,
  agentId,
}: UpcomingTasksCalendarModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("ALL");
  const [prioritySort, setPrioritySort] = useState<"DEFAULT" | "HIGH_FIRST">("HIGH_FIRST");
  const [overdueItemToResolve, setOverdueItemToResolve] = useState<any | null>(null);
  const [isPending, startTx] = useTransition();

  useEffect(() => {
    setMounted(true);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getAgentCalendarTasks(agentId)
      .then((data) => {
        setTasks(data as any);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load calendar tasks:", e);
        setLoading(false);
      });
  }, [isOpen, agentId]);

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;
    const endOfWeek = startOfToday + 7 * 24 * 60 * 60 * 1000;
    const endOfMonth = startOfToday + 30 * 24 * 60 * 60 * 1000;

    let list = tasks.filter((t) => {
      const isCompleted = t.status === "COMPLETED";
      const dueTime = t.dueDate ? new Date(t.dueDate).getTime() : null;

      if (filterTab === "OVERDUE") {
        return !isCompleted && dueTime != null && dueTime < now.getTime();
      }
      if (filterTab === "TODAY") {
        return dueTime != null && dueTime >= startOfToday && dueTime <= endOfToday;
      }
      if (filterTab === "WEEK") {
        return dueTime != null && dueTime >= startOfToday && dueTime <= endOfWeek;
      }
      if (filterTab === "MONTH") {
        return dueTime != null && dueTime >= startOfToday && dueTime <= endOfMonth;
      }
      return true; // ALL
    });

    if (prioritySort === "HIGH_FIRST") {
      const pWeight: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      list = [...list].sort((a, b) => {
        const wA = pWeight[a.priority] || 1;
        const wB = pWeight[b.priority] || 1;
        if (wB !== wA) return wB - wA;
        // then by due date
        const dA = a.dueDate ? new Date(a.dueDate).getTime() : 9999999999999;
        const dB = b.dueDate ? new Date(b.dueDate).getTime() : 9999999999999;
        return dA - dB;
      });
    }

    return list;
  }, [tasks, filterTab, prioritySort]);

  async function handleToggleStatus(task: Task) {
    const isOverdue =
      task.status !== "COMPLETED" &&
      task.dueDate != null &&
      new Date(task.dueDate).getTime() < new Date().getTime();

    // Strict Accountability: Force modal if overdue
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

    // Optimistic
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus, completedAt: nextStatus === "COMPLETED" ? new Date() : null } : t))
    );

    startTx(async () => {
      try {
        await updateTaskStatus(task.id, nextStatus as any);
      } catch (err) {
        console.error("Failed to update status:", err);
      }
    });
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99998,
        background: "rgba(3, 6, 16, 0.9)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          background: "linear-gradient(180deg, #111827 0%, #090e1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 22,
          padding: "1.75rem",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.7)",
          animation: "scaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
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
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.25rem" }}>📅</span>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>
                Long-Term Tasks & Directives Calendar
              </h2>
            </div>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8rem", color: "#9ca3af" }}>
              Comprehensive accountability view of upcoming and scheduled directives
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#8b8aa8",
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter Tabs & Sorting Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginBottom: "1rem",
          }}
        >
          {/* Timeline Filter Pills */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {[
              { id: "ALL", label: "All Tasks" },
              { id: "TODAY", label: "Today" },
              { id: "WEEK", label: "This Week" },
              { id: "MONTH", label: "This Month" },
              { id: "OVERDUE", label: "⚠️ Overdue" },
            ].map((tab) => {
              const isSelected = filterTab === tab.id;
              const isOverdueTab = tab.id === "OVERDUE";
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id as FilterTab)}
                  style={{
                    padding: "0.35rem 0.75rem",
                    borderRadius: "99px",
                    border: isSelected
                      ? isOverdueTab ? "1.5px solid #ef4444" : "1.5px solid #20C997"
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    background: isSelected
                      ? isOverdueTab ? "rgba(239, 68, 68, 0.15)" : "rgba(32, 201, 151, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    color: isSelected
                      ? isOverdueTab ? "#f87171" : "#20C997"
                      : "#9ca3af",
                    fontSize: "0.76rem",
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Priority Sort Toggle */}
          <button
            type="button"
            onClick={() => setPrioritySort(prioritySort === "HIGH_FIRST" ? "DEFAULT" : "HIGH_FIRST")}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.12)",
              background: "rgba(255, 255, 255, 0.04)",
              color: prioritySort === "HIGH_FIRST" ? "#f59e0b" : "#d1d5db",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span>⚡ Sort: {prioritySort === "HIGH_FIRST" ? "Priority (High First)" : "Date Order"}</span>
          </button>
        </div>

        {/* Task List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.65rem", paddingRight: "0.25rem" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#8b8aa8", fontSize: "0.85rem" }}>
              Loading task calendar…
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#8b8aa8", fontSize: "0.85rem" }}>
              No tasks match this calendar filter.
            </div>
          ) : (
            filteredTasks.map((task) => {
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
                    padding: "0.85rem 1rem",
                    borderRadius: "12px",
                    background: isCompleted
                      ? "rgba(255, 255, 255, 0.01)"
                      : isOverdue
                      ? "rgba(239, 68, 68, 0.04)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: isCompleted
                      ? "1px solid rgba(255, 255, 255, 0.04)"
                      : isOverdue
                      ? "2px solid #ef4444" // Strict solid red outline
                      : "1px solid rgba(255, 255, 255, 0.08)",
                    boxShadow: isOverdue ? "0 0 15px rgba(239, 68, 68, 0.2)" : "none",
                    opacity: isCompleted ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Status Toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(task)}
                    disabled={isPending}
                    style={{
                      width: "22px",
                      height: "22px",
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
                      fontSize: "0.85rem",
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
                        marginBottom: "0.3rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {task.title && (
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "0.9rem",
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
                          fontWeight: 800,
                          color: pMeta.color,
                          background: pMeta.bg,
                          border: `1px solid ${pMeta.border}`,
                          padding: "0.15rem 0.5rem",
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
                            padding: "0.15rem 0.5rem",
                            borderRadius: "4px",
                            background: countdown.isOverdue ? "rgba(239, 68, 68, 0.18)" : "rgba(32, 201, 151, 0.12)",
                            border: countdown.isOverdue ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(32, 201, 151, 0.3)",
                            color: countdown.isOverdue ? "#f87171" : "#20C997",
                          }}
                        >
                          ⏳ {countdown.text}
                        </span>
                      )}

                      {task.dueDate && (
                        <span style={{ fontSize: "0.72rem", color: "#8b8aa8", marginLeft: "auto" }}>
                          Due: {new Date(task.dueDate).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        color: isCompleted ? "#8b8aa8" : "#e2e8f0",
                        fontSize: "0.85rem",
                        lineHeight: 1.45,
                        textDecoration: isCompleted ? "line-through" : "none",
                      }}
                    >
                      {task.message}
                    </div>

                    {/* Delay & Countermeasure record if previously resolved */}
                    {task.overdueReason && (
                      <div
                        style={{
                          marginTop: "0.5rem",
                          padding: "0.45rem 0.65rem",
                          borderRadius: 8,
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          fontSize: "0.72rem",
                          color: "#9ca3af",
                        }}
                      >
                        <div><strong style={{ color: "#f87171" }}>Delay Reason:</strong> {task.overdueReason}</div>
                        {task.countermeasure && (
                          <div style={{ marginTop: "0.2rem" }}><strong style={{ color: "#20C997" }}>Countermeasure:</strong> {task.countermeasure}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
    </div>,
    document.body
  );
}

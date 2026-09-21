"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface TaskItem {
  id: string;
  title?: string | null;
  message: string;
  priority: string;
  status: string;
  dueDate?: string | Date | null;
}

interface FollowUpItem {
  id: string;
  scheduledAt: string | Date;
  note: string;
  lead: {
    id: string;
    name: string;
    phone: string;
  };
}

interface DailyBriefingModalProps {
  agentId: string;
  agentName: string;
  tasks: TaskItem[];
  followUps: FollowUpItem[];
}

export default function DailyBriefingModal({
  agentId,
  agentName,
  tasks,
  followUps,
}: DailyBriefingModalProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateKey = `daily_briefing_${agentId}_${yyyy}-${mm}-${dd}`;

    const dismissed = localStorage.getItem(dateKey);
    if (!dismissed) {
      setIsOpen(true);
    }
  }, [agentId]);

  function handleDismiss() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateKey = `daily_briefing_${agentId}_${yyyy}-${mm}-${dd}`;

    try {
      localStorage.setItem(dateKey, "true");
    } catch (e) {}

    setIsOpen(false);
  }

  function handleDismissAndGoToInbox() {
    handleDismiss();
    router.push("/dashboard/agent/inbox");
  }

  if (!mounted || !isOpen) return null;

  const todayStr = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pendingTasks = tasks.filter((t) => t.status !== "COMPLETED");

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(3, 6, 15, 0.92)",
        backdropFilter: "blur(12px)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          background: "linear-gradient(180deg, #131b2e 0%, #090e1a 100%)",
          border: "1.5px solid rgba(32, 201, 151, 0.3)",
          borderRadius: "24px",
          boxShadow: "0 25px 70px rgba(0, 0, 0, 0.9), 0 0 40px rgba(32, 201, 151, 0.15)",
          padding: "2rem",
          maxHeight: "92vh",
          overflowY: "auto",
          animation: "scaleInBriefing 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Top Header */}
        <div style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.25rem 0.65rem",
                borderRadius: "99px",
                background: "rgba(32, 201, 151, 0.12)",
                border: "1px solid rgba(32, 201, 151, 0.3)",
                color: "#20C997",
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              <span>🌅</span> Morning Briefing
            </span>
            <span style={{ fontSize: "0.78rem", color: "#8b8aa8" }}>{todayStr}</span>
          </div>

          <h2 style={{ margin: "0.25rem 0 0.15rem", fontSize: "1.35rem", fontWeight: 800, color: "#f8fafc" }}>
            Welcome back, {agentName}!
          </h2>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#9ca3af" }}>
            Here is your operational lineup for today. Please review before proceeding.
          </p>
        </div>

        {/* Overview Badges */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "14px",
              background: "rgba(249, 115, 22, 0.08)",
              border: "1px solid rgba(249, 115, 22, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>⏰</span>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#fb923c" }}>
                {followUps.length}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#d1d5db", fontWeight: 600 }}>
                Follow-Ups Scheduled
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "0.85rem",
              borderRadius: "14px",
              background: "rgba(32, 201, 151, 0.08)",
              border: "1px solid rgba(32, 201, 151, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>📋</span>
            <div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#20C997" }}>
                {pendingTasks.length}
              </div>
              <div style={{ fontSize: "0.72rem", color: "#d1d5db", fontWeight: 600 }}>
                Pending Directives
              </div>
            </div>
          </div>
        </div>

        {/* Scheduled Follow-ups section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ fontSize: "0.95rem" }}>⏰</span>
              <h4 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#f1f0ff" }}>
                Scheduled Lead Follow-Ups ({followUps.length})
              </h4>
            </div>
            {followUps.length > 0 && (
              <span style={{ fontSize: "0.72rem", color: "#fb923c", fontWeight: 700 }}>
                Priority Action Items
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {followUps.length === 0 ? (
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.1)",
                  color: "#8b8aa8",
                  fontSize: "0.8rem",
                  textAlign: "center",
                }}
              >
                No follow-ups booked yet for today. Keep prospecting!
              </div>
            ) : (
              followUps.map((fu) => {
                const priority = (fu as any).priority || "MEDIUM";
                const pColor = priority === "HIGH" ? "#ef4444" : priority === "MEDIUM" ? "#fb923c" : "#60a5fa";

                return (
                  <div
                    key={fu.id}
                    style={{
                      padding: "0.8rem 0.95rem",
                      borderRadius: "12px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(249, 115, 22, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.88rem", fontWeight: 800, color: "#ffffff" }}>
                          {fu.lead.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: 800,
                            padding: "0.1rem 0.4rem",
                            borderRadius: "4px",
                            background: `${pColor}20`,
                            border: `1px solid ${pColor}40`,
                            color: pColor,
                          }}
                        >
                          {priority}
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#9ca3af" }}>
                          📱 {fu.lead.phone}
                        </span>
                      </div>
                      {fu.note && (
                        <div style={{ fontSize: "0.75rem", color: "#e2e8f0", marginTop: "0.25rem", lineHeight: 1.35 }}>
                          📝 {fu.note}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#fb923c",
                          background: "rgba(249, 115, 22, 0.12)",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(fu.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>

                      <Link
                        href={`/dashboard/agent/chat/${fu.lead.id}`}
                        onClick={() => handleDismiss()}
                        style={{
                          padding: "0.3rem 0.65rem",
                          borderRadius: "6px",
                          background: "rgba(32, 201, 151, 0.15)",
                          border: "1px solid rgba(32, 201, 151, 0.35)",
                          color: "#20C997",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Chat Lead ➔
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Tasks Section */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.6rem" }}>
            <span style={{ fontSize: "0.9rem" }}>📋</span>
            <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "#f1f0ff" }}>
              Action Items & Directives
            </h4>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {pendingTasks.length === 0 ? (
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px dashed rgba(255, 255, 255, 0.1)",
                  color: "#8b8aa8",
                  fontSize: "0.8rem",
                  textAlign: "center",
                }}
              >
                All tasks are cleared. Great job!
              </div>
            ) : (
              pendingTasks.slice(0, 4).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: "0.75rem 0.9rem",
                    borderRadius: "12px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    {t.title && (
                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#f1f0ff" }}>
                        {t.title}
                      </div>
                    )}
                    <div style={{ fontSize: "0.78rem", color: "#d1d5db" }}>{t.message}</div>
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: t.priority === "URGENT" ? "#ef4444" : "#60a5fa",
                      background: t.priority === "URGENT" ? "rgba(239, 68, 68, 0.15)" : "rgba(96, 165, 250, 0.1)",
                      border: `1px solid ${t.priority === "URGENT" ? "rgba(239, 68, 68, 0.3)" : "rgba(96, 165, 250, 0.2)"}`,
                      padding: "0.2rem 0.45rem",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.priority}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
          <button
            onClick={handleDismissAndGoToInbox}
            style={{
              width: "100%",
              padding: "0.95rem",
              borderRadius: "14px",
              border: "none",
              background: "linear-gradient(135deg, #059669 0%, #20C997 100%)",
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(32, 201, 151, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            Acknowledge & Proceed to Chat Feed →
          </button>

          <button
            onClick={handleDismiss}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b8aa8",
              fontSize: "0.78rem",
              cursor: "pointer",
              padding: "0.3rem",
            }}
          >
            Dismiss and stay on current page
          </button>
        </div>
      </div>

      <style>{`
        @keyframes scaleInBriefing {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}

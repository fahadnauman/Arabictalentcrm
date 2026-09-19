"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getAgentFollowUps, completeFollowUp } from "@/app/actions/followup";

interface FollowUpItem {
  id: string;
  leadId: string;
  scheduledAt: string | Date;
  note: string;
  status: string;
  lead: {
    id: string;
    name: string;
    phone: string;
    company?: string | null;
  };
}

export default function FollowUpAlertWatcher() {
  const [activeAlert, setActiveAlert] = useState<FollowUpItem | null>(null);
  const alertedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Restore already alerted IDs from session storage to avoid alert fatigue
    try {
      const stored = sessionStorage.getItem("alerted_followups");
      if (stored) {
        alertedIdsRef.current = new Set(JSON.parse(stored));
      }
    } catch (e) {
      // Ignore storage errors
    }

    async function checkFollowUps() {
      try {
        const followUps = await getAgentFollowUps();
        const now = new Date().getTime();

        for (const fu of followUps) {
          const schedTime = new Date(fu.scheduledAt).getTime();
          // Trigger if scheduled time has arrived or passed (within last 24 hours) and hasn't been alerted
          if (
            schedTime <= now &&
            now - schedTime < 24 * 60 * 60 * 1000 &&
            !alertedIdsRef.current.has(fu.id)
          ) {
            alertedIdsRef.current.add(fu.id);
            try {
              sessionStorage.setItem(
                "alerted_followups",
                JSON.stringify(Array.from(alertedIdsRef.current))
              );
            } catch (e) {}

            setActiveAlert(fu as any);
            break; // Show one prominent alert at a time
          }
        }
      } catch (err) {
        console.warn("Follow-up check error:", err);
      }
    }

    // Initial check after 3 seconds
    const initTimer = setTimeout(checkFollowUps, 3000);
    // Recurring polling check every 30 seconds
    const interval = setInterval(checkFollowUps, 30000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  if (!activeAlert) return null;

  async function handleComplete() {
    if (!activeAlert) return;
    try {
      await completeFollowUp(activeAlert.id);
    } catch (e) {}
    setActiveAlert(null);
  }

  function handleDismiss() {
    setActiveAlert(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 99999,
        width: "92vw",
        maxWidth: "480px",
        background: "linear-gradient(135deg, #1c140c 0%, #111827 100%)",
        border: "1.5px solid #f97316",
        borderRadius: "16px",
        padding: "1rem 1.25rem",
        boxShadow: "0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(249,115,22,0.35)",
        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: "rgba(249, 115, 22, 0.2)",
            border: "1px solid rgba(249, 115, 22, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.3rem",
            flexShrink: 0,
            animation: "pulseIcon 1.5s infinite",
          }}
        >
          ⏰
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#fb923c",
              }}
            >
              Follow-Up Due Now
            </span>
            <button
              onClick={handleDismiss}
              style={{
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontSize: "1rem",
                padding: "0 0.25rem",
              }}
              title="Dismiss notification"
            >
              ✕
            </button>
          </div>

          <div
            style={{
              color: "#ffffff",
              fontSize: "0.95rem",
              fontWeight: 700,
              marginTop: "0.2rem",
            }}
          >
            Contact {activeAlert.lead.name}
          </div>

          <div style={{ color: "#d1d5db", fontSize: "0.8rem", marginTop: "0.15rem" }}>
            📱 {activeAlert.lead.phone}
          </div>

          {activeAlert.note && (
            <div
              style={{
                marginTop: "0.4rem",
                padding: "0.4rem 0.6rem",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "8px",
                fontSize: "0.78rem",
                color: "#e5e7eb",
                lineHeight: 1.35,
              }}
            >
              <strong style={{ color: "#fb923c" }}>Note: </strong>
              {activeAlert.note}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Link
              href={`/dashboard/agent/chat/${activeAlert.lead.id}`}
              onClick={() => setActiveAlert(null)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "0.45rem 0.75rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #ea580c, #f97316)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.82rem",
                textDecoration: "none",
                boxShadow: "0 2px 10px rgba(249, 115, 22, 0.4)",
              }}
            >
              Open Lead Chat →
            </Link>

            <button
              onClick={handleComplete}
              style={{
                padding: "0.45rem 0.75rem",
                borderRadius: "8px",
                background: "rgba(32, 201, 151, 0.15)",
                border: "1px solid rgba(32, 201, 151, 0.35)",
                color: "#20C997",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
              title="Mark completed"
            >
              ✓ Done
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes pulseIcon {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

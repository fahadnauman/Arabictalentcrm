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

interface ActiveAlert {
  item: FollowUpItem;
  isPreReminder: boolean;
  minutesRemaining?: number;
}

// ── Native Web Audio API Chime Synthesizer ─────────────────────────────────
function playWebAudioChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.22, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: 880.00 Hz (A5 - harmonic chime)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.28, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (e) {
    console.warn("Native Web Audio API chime could not play:", e);
  }
}

export default function FollowUpAlertWatcher() {
  const [activeAlert, setActiveAlert] = useState<ActiveAlert | null>(null);
  const alertedDueIdsRef = useRef<Set<string>>(new Set());
  const alertedPreIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Restore already alerted IDs from session storage
    try {
      const storedDue = sessionStorage.getItem("alerted_followups_due");
      if (storedDue) alertedDueIdsRef.current = new Set(JSON.parse(storedDue));

      const storedPre = sessionStorage.getItem("alerted_followups_pre");
      if (storedPre) alertedPreIdsRef.current = new Set(JSON.parse(storedPre));
    } catch (e) {}

    async function checkUpcomingFollowUps() {
      try {
        const followUps = await getAgentFollowUps();
        const now = new Date().getTime();

        for (const fu of followUps) {
          const schedTime = new Date(fu.scheduledAt).getTime();
          const diffMs = schedTime - now;

          // 1. Check for 5-Minute Pre-Reminder (Between 0 and 5 minutes in the future)
          if (diffMs > 0 && diffMs <= 5 * 60 * 1000 && !alertedPreIdsRef.current.has(fu.id)) {
            alertedPreIdsRef.current.add(fu.id);
            try {
              sessionStorage.setItem(
                "alerted_followups_pre",
                JSON.stringify(Array.from(alertedPreIdsRef.current))
              );
            } catch (e) {}

            const mins = Math.max(1, Math.round(diffMs / (60 * 1000)));
            playWebAudioChime();
            setActiveAlert({
              item: fu as any,
              isPreReminder: true,
              minutesRemaining: mins,
            });
            break; // Show one prominent alert at a time
          }

          // 2. Check for Due Now Reminder (Arrived or passed within last 24 hours)
          if (diffMs <= 0 && now - schedTime < 24 * 60 * 60 * 1000 && !alertedDueIdsRef.current.has(fu.id)) {
            alertedDueIdsRef.current.add(fu.id);
            try {
              sessionStorage.setItem(
                "alerted_followups_due",
                JSON.stringify(Array.from(alertedDueIdsRef.current))
              );
            } catch (e) {}

            playWebAudioChime();
            setActiveAlert({
              item: fu as any,
              isPreReminder: false,
            });
            break;
          }
        }
      } catch (err) {
        console.warn("Follow-up reminder check error:", err);
      }
    }

    // Initial check after 2 seconds
    const initTimer = setTimeout(checkUpcomingFollowUps, 2000);
    // Recurring check every 25 seconds
    const interval = setInterval(checkUpcomingFollowUps, 25000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  if (!activeAlert) return null;

  async function handleComplete() {
    if (!activeAlert) return;
    try {
      await completeFollowUp(activeAlert.item.id);
    } catch (e) {}
    setActiveAlert(null);
  }

  function handleDismiss() {
    setActiveAlert(null);
  }

  const { item, isPreReminder, minutesRemaining } = activeAlert;

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
        background: isPreReminder
          ? "linear-gradient(135deg, #191c10 0%, #111827 100%)"
          : "linear-gradient(135deg, #1c140c 0%, #111827 100%)",
        border: isPreReminder ? "1.5px solid #20C997" : "1.5px solid #f97316",
        borderRadius: "16px",
        padding: "1rem 1.25rem",
        boxShadow: isPreReminder
          ? "0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(32,201,151,0.35)"
          : "0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(249,115,22,0.35)",
        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: isPreReminder ? "rgba(32, 201, 151, 0.2)" : "rgba(249, 115, 22, 0.2)",
            border: isPreReminder ? "1px solid rgba(32, 201, 151, 0.4)" : "1px solid rgba(249, 115, 22, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.3rem",
            flexShrink: 0,
            animation: "pulseIcon 1.5s infinite",
          }}
        >
          {isPreReminder ? "⚡" : "⏰"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: isPreReminder ? "#20C997" : "#fb923c",
              }}
            >
              {isPreReminder ? `⚡ 5-Minute Warning (${minutesRemaining}m to go)` : "⏰ Follow-Up Due Now"}
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
              title="Dismiss alert"
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
            Contact {item.lead.name}
          </div>

          <div style={{ color: "#d1d5db", fontSize: "0.8rem", marginTop: "0.15rem" }}>
            📱 {item.lead.phone}
          </div>

          {item.note && (
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
              <strong style={{ color: isPreReminder ? "#20C997" : "#fb923c" }}>Directive / Note: </strong>
              {item.note}
            </div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
            <Link
              href={`/dashboard/agent/chat/${item.lead.id}`}
              onClick={() => setActiveAlert(null)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "0.45rem 0.75rem",
                borderRadius: "8px",
                background: isPreReminder
                  ? "linear-gradient(135deg, #159d74, #20C997)"
                  : "linear-gradient(135deg, #ea580c, #f97316)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "0.82rem",
                textDecoration: "none",
                boxShadow: isPreReminder ? "0 2px 10px rgba(32, 201, 151, 0.4)" : "0 2px 10px rgba(249, 115, 22, 0.4)",
              }}
            >
              Open Lead Chat →
            </Link>

            {!isPreReminder && (
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
            )}
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

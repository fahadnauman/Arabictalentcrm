"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  company?: string | null;
  source?: string | null;
  status: string;
  createdAt: string;
  assignedAgentId?: string | null;
}

// ── Native Web Audio API Chime Synthesizer for New Leads ───────────────────────
function playNewLeadChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic Chord Note 1: 523.25 Hz (C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Harmonic Chord Note 2: 659.25 Hz (E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.09);
    gain2.gain.setValueAtTime(0.26, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.09);
    osc2.stop(now + 0.55);

    // Harmonic High Ring Note 3: 1046.50 Hz (C6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(1046.5, now + 0.18);
    gain3.gain.setValueAtTime(0.3, now + 0.18);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.18);
    osc3.stop(now + 0.75);
  } catch (err) {
    console.warn("[WebAudio] Chime playback inhibited:", err);
  }
}

export default function GlobalLeadNotificationWatcher() {
  const router = useRouter();
  const [incomingLead, setIncomingLead] = useState<LeadItem | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const lastTimestampRef = useRef<string>(new Date().toISOString());
  const initialFetchDoneRef = useRef(false);

  useEffect(() => {
    // Restore seen IDs from sessionStorage to prevent alerting for historical leads
    try {
      const stored = sessionStorage.getItem("seen_lead_ids");
      if (stored) {
        seenIdsRef.current = new Set(JSON.parse(stored));
      }
    } catch (e) {}

    async function pollNewLeads() {
      try {
        const since = lastTimestampRef.current;
        const res = await fetch(`/api/leads/latest?since=${encodeURIComponent(since)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.timestamp) {
          lastTimestampRef.current = data.timestamp;
        }

        const leads: LeadItem[] = data.leads || [];

        // If this is the very first poll, initialize seen IDs without chiming
        if (!initialFetchDoneRef.current) {
          initialFetchDoneRef.current = true;
          for (const l of leads) {
            seenIdsRef.current.add(l.id);
          }
          try {
            sessionStorage.setItem(
              "seen_lead_ids",
              JSON.stringify(Array.from(seenIdsRef.current))
            );
          } catch (e) {}
          return;
        }

        // Check for genuine newly arrived leads
        for (const lead of leads) {
          if (!seenIdsRef.current.has(lead.id)) {
            seenIdsRef.current.add(lead.id);
            try {
              sessionStorage.setItem(
                "seen_lead_ids",
                JSON.stringify(Array.from(seenIdsRef.current))
              );
            } catch (e) {}

            // Trigger chime
            playNewLeadChime();

            // Trigger global toast
            setIncomingLead(lead);

            // Broadcast real-time DOM event so Home screen counter updates instantly
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("new-lead-received", { detail: lead })
              );
            }
            break;
          }
        }
      } catch (err) {
        console.warn("[GlobalLeadNotificationWatcher] poll error:", err);
      }
    }

    // Initial check after 1.5 seconds
    const initTimer = setTimeout(pollNewLeads, 1500);
    // Recurring check every 4 seconds
    const interval = setInterval(pollNewLeads, 4000);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
    };
  }, []);

  // Auto-dismiss toast after 9 seconds
  useEffect(() => {
    if (!incomingLead) return;
    const timer = setTimeout(() => {
      setIncomingLead(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [incomingLead]);

  if (!incomingLead) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 999999,
        width: "calc(100% - 24px)",
        maxWidth: 440,
        background: "linear-gradient(135deg, #0d1527 0%, #080c16 100%)",
        border: "1.5px solid #20C997",
        borderRadius: 16,
        padding: "0.85rem 1rem",
        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(32, 201, 151, 0.25)",
        animation: "slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(32, 201, 151, 0.15)",
            border: "1px solid rgba(32, 201, 151, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
            flexShrink: 0,
          }}
        >
          ⚡
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#20C997" }}>
              New Lead Arrived!
            </span>
            {incomingLead.source && (
              <span
                style={{
                  fontSize: "0.62rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  padding: "0.05rem 0.35rem",
                  borderRadius: 4,
                  color: "#9ca3af",
                }}
              >
                {incomingLead.source}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#f1f0ff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: "0.1rem",
            }}
          >
            {incomingLead.name || "Unknown Lead"}
            <span style={{ color: "#8b8aa8", fontWeight: 500, marginLeft: "0.4rem" }}>
              {incomingLead.phone}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => {
            setIncomingLead(null);
            router.push(`/dashboard/agent/chat/${incomingLead.id}`);
          }}
          style={{
            background: "linear-gradient(135deg, #20C997, #10b981)",
            border: "none",
            borderRadius: 10,
            padding: "0.45rem 0.8rem",
            color: "#ffffff",
            fontSize: "0.78rem",
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(32, 201, 151, 0.35)",
            whiteSpace: "nowrap",
          }}
        >
          Open Chat
        </button>
        <button
          type="button"
          onClick={() => setIncomingLead(null)}
          style={{
            background: "transparent",
            border: "none",
            color: "#6b7280",
            fontSize: "1.1rem",
            cursor: "pointer",
            padding: "0.2rem",
            display: "flex",
            alignItems: "center",
          }}
          title="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateLeadTemperature } from "@/app/actions/lead";
import { LeadTemperature } from "@prisma/client";

interface TemperatureToggleProps {
  leadId: string;
  initialTemperature: LeadTemperature;
}

const TEMP_CONFIG: Record<
  LeadTemperature,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  HOT: {
    label: "Hot",
    icon: "🔥",
    color: "#f87171",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.35)",
  },
  WARM: {
    label: "Warm",
    icon: "☀️",
    color: "#fbbf24",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.35)",
  },
  COLD: {
    label: "Cold",
    icon: "❄️",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.15)",
    border: "rgba(56, 189, 248, 0.35)",
  },
};

export default function TemperatureToggle({
  leadId,
  initialTemperature = "WARM",
}: TemperatureToggleProps) {
  const [currentTemp, setCurrentTemp] = useState<LeadTemperature>(initialTemperature);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTx] = useTransition();

  const activeCfg = TEMP_CONFIG[currentTemp] || TEMP_CONFIG.WARM;

  async function handleSelect(newTemp: LeadTemperature) {
    if (newTemp === currentTemp) {
      setIsOpen(false);
      return;
    }

    const previous = currentTemp;
    setCurrentTemp(newTemp);
    setIsOpen(false);

    startTx(async () => {
      try {
        await updateLeadTemperature(leadId, newTemp);
      } catch (err) {
        console.error("Failed to update temperature:", err);
        setCurrentTemp(previous); // Rollback
      }
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {/* Current Temperature Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.25rem 0.65rem",
          borderRadius: "99px",
          background: activeCfg.bg,
          border: `1.5px solid ${activeCfg.border}`,
          color: activeCfg.color,
          fontSize: "0.72rem",
          fontWeight: 800,
          cursor: "pointer",
          letterSpacing: "0.03em",
          transition: "all 0.15s ease",
          boxShadow: isPending ? "none" : `0 0 10px ${activeCfg.color}25`,
        }}
        title="Click to toggle Lead Temperature (Hot / Warm / Cold)"
      >
        <span>{activeCfg.icon}</span>
        <span>{activeCfg.label}</span>
        <span style={{ fontSize: "0.55rem", opacity: 0.7, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>▼</span>
      </button>

      {/* Popover Selection Menu */}
      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
          />
          <div
            style={{
              position: "absolute",
              top: "125%",
              right: 0,
              zIndex: 1000,
              background: "#0c101d",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: "12px",
              padding: "0.35rem",
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              minWidth: "120px",
              animation: "fadeIn 0.15s ease",
            }}
          >
            {(["HOT", "WARM", "COLD"] as LeadTemperature[]).map((temp) => {
              const cfg = TEMP_CONFIG[temp];
              const isSelected = currentTemp === temp;

              return (
                <button
                  key={temp}
                  type="button"
                  onClick={() => handleSelect(temp)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "8px",
                    border: isSelected ? `1px solid ${cfg.border}` : "1px solid transparent",
                    background: isSelected ? cfg.bg : "transparent",
                    color: isSelected ? cfg.color : "#d1d5db",
                    fontSize: "0.78rem",
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  <span>{cfg.icon}</span>
                  <span>{cfg.label}</span>
                  {isSelected && <span style={{ marginLeft: "auto", fontSize: "0.7rem" }}>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

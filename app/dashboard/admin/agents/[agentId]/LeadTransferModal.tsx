"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { transferLead } from "@/app/actions/lead";

interface TargetAgentOption {
  id: string;
  name: string;
  email: string;
  languageGroup: string;
}

interface LeadTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: {
    id: string;
    name: string;
    phone?: string;
  } | null;
  currentAgentId: string;
  availableAgents: TargetAgentOption[];
}

export default function LeadTransferModal({
  isOpen,
  onClose,
  lead,
  currentAgentId,
  availableAgents,
}: LeadTransferModalProps) {
  const router = useRouter();
  const [isPending, startTx] = useTransition();
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const eligibleAgents = availableAgents.filter((a) => a.id !== currentAgentId);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      setSelectedAgentId(eligibleAgents[0]?.id || "");
      setError("");
      setSuccess(false);
    }
  }, [isOpen]);

  if (!mounted || !isOpen || !lead) return null;

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!selectedAgentId) {
      setError("Please select a target agent.");
      return;
    }

    startTx(async () => {
      try {
        await transferLead(lead!.id, selectedAgentId);
        setSuccess(true);
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 1000);
      } catch (err: any) {
        setError(err.message || "Failed to transfer lead.");
      }
    });
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10, 14, 26, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
          border: "1px solid rgba(0, 255, 255, 0.3)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "460px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(0,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#f1f0ff", fontSize: "1.1rem", fontWeight: 700 }}>
              Admin Override: Transfer Lead
            </h3>
            <span style={{ fontSize: "0.8rem", color: "#00ffff" }}>
              {lead.name} {lead.phone ? `(${lead.phone})` : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b8aa8",
              fontSize: "1.25rem",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleTransfer} style={{ padding: "1.5rem" }}>
          {error && (
            <div
              style={{
                background: "rgba(248, 113, 113, 0.15)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                borderRadius: "8px",
                padding: "0.75rem",
                color: "#f87171",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
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
                padding: "0.75rem",
                color: "#20C997",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              ✓ Lead successfully transferred! Updating portfolio...
            </div>
          )}

          <div style={{ marginBottom: "1.25rem" }}>
            <label
              style={{
                display: "block",
                color: "#8b8aa8",
                fontSize: "0.8rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Select Destination Agent
            </label>

            {eligibleAgents.length === 0 ? (
              <div style={{ color: "#8b8aa8", fontSize: "0.85rem", padding: "1rem 0" }}>
                No other active agents available to receive this lead.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "240px", overflowY: "auto" }}>
                {eligibleAgents.map((ag) => {
                  const isSelected = selectedAgentId === ag.id;
                  return (
                    <div
                      key={ag.id}
                      onClick={() => setSelectedAgentId(ag.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        borderRadius: "10px",
                        cursor: "pointer",
                        background: isSelected
                          ? "rgba(0, 255, 255, 0.1)"
                          : "rgba(255, 255, 255, 0.03)",
                        border: isSelected
                          ? "1px solid #00ffff"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div>
                        <div style={{ color: isSelected ? "#00ffff" : "#f1f0ff", fontWeight: 600, fontSize: "0.9rem" }}>
                          {ag.name}
                        </div>
                        <div style={{ color: "#8b8aa8", fontSize: "0.75rem" }}>
                          {ag.email}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.2rem 0.6rem",
                          borderRadius: "99px",
                          background:
                            ag.languageGroup === "MALAYALAM"
                              ? "rgba(250,204,21,0.15)"
                              : "rgba(0,255,255,0.15)",
                          color:
                            ag.languageGroup === "MALAYALAM" ? "#facc15" : "#00ffff",
                          border: `1px solid ${
                            ag.languageGroup === "MALAYALAM"
                              ? "rgba(250,204,21,0.3)"
                              : "rgba(0,255,255,0.3)"
                          }`,
                        }}
                      >
                        {ag.languageGroup}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1.5rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#8b8aa8",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || eligibleAgents.length === 0}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #00ffff 0%, #0077b6 100%)",
                border: "none",
                color: "#0a0e1a",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: isPending || eligibleAgents.length === 0 ? "not-allowed" : "pointer",
                opacity: isPending || eligibleAgents.length === 0 ? 0.6 : 1,
              }}
            >
              {isPending ? "Transferring..." : "Confirm Transfer"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

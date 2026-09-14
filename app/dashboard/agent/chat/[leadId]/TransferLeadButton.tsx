"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { transferLead, getActiveAgents, ActiveAgentItem } from "@/app/actions/lead";

interface Props {
  leadId: string;
  leadName: string;
  currentAgentId?: string;
  initialAgents?: ActiveAgentItem[];
}

export default function TransferLeadButton({
  leadId,
  leadName,
  currentAgentId,
  initialAgents,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [agents, setAgents] = useState<ActiveAgentItem[]>(initialAgents || []);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch agents if not already provided or if opening
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setSelectedAgentId("");
      setSearchQuery("");

      if (!initialAgents || initialAgents.length === 0) {
        setIsLoadingAgents(true);
        getActiveAgents()
          .then((data) => setAgents(data))
          .catch((err) => setError(err.message || "Failed to load agents"))
          .finally(() => setIsLoadingAgents(false));
      } else {
        setAgents(initialAgents);
      }
    }
  }, [isOpen, initialAgents]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isPending) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending]);

  const filteredAgents = agents.filter((agent) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      agent.name.toLowerCase().includes(q) ||
      agent.email.toLowerCase().includes(q) ||
      agent.languageGroup.toLowerCase().includes(q)
    );
  });

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  async function handleConfirmTransfer() {
    if (!selectedAgentId) {
      setError("Please select an agent to receive this lead.");
      return;
    }

    if (selectedAgentId === currentAgentId) {
      setError("This lead is already assigned to this agent.");
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        const res = await transferLead(leadId, selectedAgentId);
        if (res.success) {
          setSuccessMsg(`✓ Successfully transferred to ${res.targetAgent.name}! Redirecting...`);
          // Optimistically redirect back to inbox and refresh so lead instantly disappears
          setTimeout(() => {
            router.push("/dashboard/agent/inbox");
            router.refresh();
          }, 600);
        }
      } catch (err: any) {
        setError(err.message || "Failed to transfer lead. Please try again.");
      }
    });
  }

  return (
    <>
      {/* ── Trigger Button in Chat Header ──────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title="Transfer Lead to another agent"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "8px",
          background: "rgba(59, 130, 246, 0.15)",
          border: "1px solid rgba(59, 130, 246, 0.35)",
          color: "#60a5fa",
          fontSize: "0.75rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.15s ease",
          fontFamily: "inherit",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(59, 130, 246, 0.25)";
          e.currentTarget.style.borderColor = "#60a5fa";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
          e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.35)";
        }}
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 3h5v5" />
          <path d="M4 20L21 3" />
          <path d="M21 16v5h-5" />
          <path d="M15 15l6 6" />
          <path d="M4 4l5 5" />
        </svg>
        Transfer
      </button>

      {/* ── Transfer Modal ─────────────────────────────────────── */}
      {mounted &&
        isOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
              background: "rgba(10, 14, 26, 0.85)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPending) {
                setIsOpen(false);
              }
            }}
          >
            <div
              style={{
                background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "480px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                boxShadow:
                  "0 20px 45px rgba(0,0,0,0.7), 0 0 35px rgba(59, 130, 246, 0.15)",
                overflow: "hidden",
                animation: "modalTransferIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "1.2rem 1.5rem",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#f1f0ff",
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.45rem",
                    }}
                  >
                    <span style={{ color: "#60a5fa" }}>⇄</span> Transfer Lead
                  </h3>
                  <p
                    style={{
                      margin: "0.25rem 0 0",
                      fontSize: "0.75rem",
                      color: "#8b8aa8",
                    }}
                  >
                    Reassign <strong>{leadName}</strong> to another agent or language pool
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isPending && setIsOpen(false)}
                  disabled={isPending}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#8b8aa8",
                    fontSize: "1.2rem",
                    cursor: isPending ? "not-allowed" : "pointer",
                    padding: "0.25rem",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Search Bar */}
              <div style={{ padding: "1rem 1.5rem 0.5rem" }}>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by agent name or language pool…"
                    disabled={isPending}
                    style={{
                      width: "100%",
                      background: "rgba(0,0,0,0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      padding: "0.6rem 0.85rem 0.6rem 2.2rem",
                      color: "#f1f0ff",
                      fontSize: "0.85rem",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                  <span
                    style={{
                      position: "absolute",
                      left: "0.75rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#8b8aa8",
                      fontSize: "0.85rem",
                    }}
                  >
                    🔍
                  </span>
                </div>
              </div>

              {/* Agent List */}
              <div
                style={{
                  padding: "0.5rem 1.5rem",
                  overflowY: "auto",
                  maxHeight: "320px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                {isLoadingAgents ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem 0",
                      color: "#8b8aa8",
                      fontSize: "0.85rem",
                    }}
                  >
                    Loading active agents…
                  </div>
                ) : filteredAgents.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "2rem 0",
                      color: "#8b8aa8",
                      fontSize: "0.85rem",
                    }}
                  >
                    No matching active agents found.
                  </div>
                ) : (
                  filteredAgents.map((agent) => {
                    const isCurrent = agent.id === currentAgentId;
                    const isSelected = agent.id === selectedAgentId;
                    const isMalayalam = agent.languageGroup?.toUpperCase() === "MALAYALAM";

                    return (
                      <div
                        key={agent.id}
                        onClick={() => {
                          if (!isCurrent && !isPending) {
                            setSelectedAgentId(agent.id);
                            setError(null);
                          }
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.75rem 1rem",
                          borderRadius: "10px",
                          background: isSelected
                            ? "rgba(59, 130, 246, 0.15)"
                            : "rgba(255, 255, 255, 0.02)",
                          border: `1px solid ${
                            isSelected
                              ? "rgba(59, 130, 246, 0.55)"
                              : isCurrent
                              ? "rgba(255, 255, 255, 0.04)"
                              : "rgba(255, 255, 255, 0.08)"
                          }`,
                          cursor: isCurrent ? "not-allowed" : isPending ? "wait" : "pointer",
                          opacity: isCurrent ? 0.45 : 1,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          {/* Avatar */}
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: isMalayalam
                                ? "linear-gradient(135deg, #f59e0b, #d97706)"
                                : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "0.75rem",
                              flexShrink: 0,
                            }}
                          >
                            {agent.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          {/* Info */}
                          <div>
                            <div
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: 600,
                                color: isSelected ? "#93c5fd" : "#f1f0ff",
                                display: "flex",
                                alignItems: "center",
                                gap: "0.4rem",
                              }}
                            >
                              {agent.name}
                              {isCurrent && (
                                <span
                                  style={{
                                    fontSize: "0.62rem",
                                    color: "#8b8aa8",
                                    fontWeight: 400,
                                  }}
                                >
                                  (Current Owner)
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#8b8aa8" }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>

                        {/* Right: Language Pill & Select Indicator */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span
                            style={{
                              fontSize: "0.62rem",
                              fontWeight: 700,
                              padding: "0.15rem 0.45rem",
                              borderRadius: "6px",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              background: isMalayalam
                                ? "rgba(245, 158, 11, 0.15)"
                                : "rgba(59, 130, 246, 0.15)",
                              border: `1px solid ${
                                isMalayalam
                                  ? "rgba(245, 158, 11, 0.35)"
                                  : "rgba(59, 130, 246, 0.35)"
                              }`,
                              color: isMalayalam ? "#fbbf24" : "#60a5fa",
                            }}
                          >
                            {isMalayalam ? "🇮🇳 Malayalam" : "GCC / English"}
                          </span>

                          <div
                            style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              border: `2px solid ${
                                isSelected ? "#3b82f6" : "rgba(255, 255, 255, 0.2)"
                              }`,
                              background: isSelected ? "#3b82f6" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#fff",
                              fontSize: "0.65rem",
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && "✓"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status / Error Messages */}
              <div style={{ padding: "0.5rem 1.5rem 0" }}>
                {error && (
                  <div
                    style={{
                      background: "rgba(248, 113, 113, 0.12)",
                      border: "1px solid rgba(248, 113, 113, 0.35)",
                      color: "#f87171",
                      fontSize: "0.78rem",
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                    }}
                  >
                    ⚠ {error}
                  </div>
                )}
                {successMsg && (
                  <div
                    style={{
                      background: "rgba(32, 201, 151, 0.12)",
                      border: "1px solid rgba(32, 201, 151, 0.35)",
                      color: "#20C997",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      padding: "0.6rem 0.85rem",
                      borderRadius: "8px",
                      textAlign: "center",
                    }}
                  >
                    {successMsg}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                  padding: "1.2rem 1.5rem",
                  borderTop: "1px solid rgba(255, 255, 255, 0.07)",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  style={{
                    padding: "0.65rem 1.1rem",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    color: "#f1f0ff",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: isPending ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmTransfer}
                  disabled={!selectedAgentId || isPending || !!successMsg}
                  style={{
                    padding: "0.65rem 1.25rem",
                    background: selectedAgentId
                      ? "linear-gradient(135deg, #3b82f6, #1d4ed8)"
                      : "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    borderRadius: "8px",
                    color: selectedAgentId ? "#ffffff" : "#8b8aa8",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: !selectedAgentId || isPending ? "not-allowed" : "pointer",
                    boxShadow: selectedAgentId
                      ? "0 4px 15px rgba(59, 130, 246, 0.4)"
                      : "none",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontFamily: "inherit",
                  }}
                >
                  {isPending ? (
                    <>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{ animation: "spin 1s linear infinite" }}
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Transferring…
                    </>
                  ) : (
                    <>Confirm Transfer{selectedAgent ? ` to ${selectedAgent.name.split(" ")[0]}` : ""}</>
                  )}
                </button>
              </div>

              <style>{`
                @keyframes modalTransferIn {
                  from { opacity: 0; transform: scale(0.96) translateY(8px); }
                  to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

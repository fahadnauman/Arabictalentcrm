"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getFullAuditTrail, AuditEvent, FullAuditTrailResponse } from "@/app/actions/audit";

interface AuditTrailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FILTER_TABS = [
  { key: "ALL", label: "All Activities" },
  { key: "TRANSFER", label: "Transfers" },
  { key: "LEAD_INTAKE", label: "Lead Intake" },
  { key: "STATUS_CHANGE", label: "Status Changes" },
  { key: "TASK_COMPLETED", label: "Task Completions" },
];

function formatDate(d: string | Date): string {
  const date = new Date(d);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AuditTrailModal({ isOpen, onClose }: AuditTrailModalProps) {
  const [data, setData] = useState<FullAuditTrailResponse | null>(null);
  const [filterType, setFilterType] = useState("ALL");
  const [page, setPage] = useState(1);
  const [isPending, startTx] = useTransition();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function loadAuditData(p = 1, filter = filterType) {
    startTx(async () => {
      try {
        const res = await getFullAuditTrail({ page: p, pageSize: 12, filterType: filter });
        setData(res);
        setPage(p);
      } catch (err) {
        console.error("Failed to load audit trail:", err);
      }
    });
  }

  useEffect(() => {
    if (isOpen) {
      loadAuditData(1, filterType);
    }
  }, [isOpen, filterType]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10, 14, 26, 0.88)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "920px",
          height: "90vh",
          maxHeight: "850px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.85), 0 0 40px rgba(32,201,151,0.1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.75rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                background: "#20C997",
                boxShadow: "0 0 12px #20C997",
              }}
            />
            <div>
              <h2 style={{ margin: 0, color: "#f1f0ff", fontSize: "1.25rem", fontWeight: 800 }}>
                Enterprise Full Audit Trail
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>
                Deep historical telemetry & lead lifecycle event log
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Link
              href="/dashboard/admin/audit"
              onClick={onClose}
              style={{
                fontSize: "0.78rem",
                color: "#20C997",
                textDecoration: "none",
                fontWeight: 600,
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(32, 201, 151, 0.1)",
                border: "1px solid rgba(32, 201, 151, 0.25)",
              }}
            >
              Open Dedicated Page ↗
            </Link>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#8b8aa8",
                fontSize: "1.4rem",
                cursor: "pointer",
                padding: "0.2rem 0.5rem",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Daily Agent Intake Summary Bar */}
        {data && data.todayAgentSummaries.length > 0 && (
          <div
            style={{
              padding: "0.85rem 1.75rem",
              background: "rgba(0, 0, 0, 0.25)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              overflowX: "auto",
            }}
          >
            <span style={{ fontSize: "0.75rem", color: "#8b8aa8", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>
              Today&apos;s Intake:
            </span>
            {data.todayAgentSummaries.map((s) => (
              <div
                key={s.agentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  padding: "0.3rem 0.65rem",
                  borderRadius: "8px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ color: "#f1f0ff", fontSize: "0.8rem", fontWeight: 600 }}>
                  {s.agentName}:
                </span>
                <span
                  style={{
                    color: s.leadCountToday > 0 ? "#20C997" : "#8b8aa8",
                    fontSize: "0.8rem",
                    fontWeight: 800,
                  }}
                >
                  {s.leadCountToday} lead{s.leadCountToday !== 1 ? "s" : ""} today
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filter Tabs */}
        <div
          style={{
            padding: "0.75rem 1.75rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            background: "rgba(255, 255, 255, 0.01)",
            overflowX: "auto",
          }}
        >
          {FILTER_TABS.map((tab) => {
            const active = filterType === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilterType(tab.key)}
                style={{
                  padding: "0.4rem 0.9rem",
                  borderRadius: "8px",
                  border: active
                    ? "1px solid rgba(32, 201, 151, 0.5)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  background: active ? "rgba(32, 201, 151, 0.15)" : "transparent",
                  color: active ? "#20C997" : "#8b8aa8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Event List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem 1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          {isPending ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#8b8aa8" }}>
              Loading audit logs...
            </div>
          ) : !data || data.events.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#8b8aa8" }}>
              No audit records matching this filter.
            </div>
          ) : (
            data.events.map((event) => (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "1rem",
                  padding: "0.9rem 1.1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "12px",
                  transition: "background 0.15s ease",
                }}
              >
                {/* Badge */}
                <span
                  style={{
                    padding: "0.25rem 0.55rem",
                    borderRadius: "6px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    background: `${event.badgeColor}22`,
                    color: event.badgeColor,
                    border: `1px solid ${event.badgeColor}44`,
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {event.badgeText}
                </span>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f1f0ff", fontSize: "0.92rem", fontWeight: 700, marginBottom: "0.2rem" }}>
                    {event.title}
                  </div>
                  <div style={{ color: "#8b8aa8", fontSize: "0.82rem", lineHeight: "1.4" }}>
                    {event.description}
                  </div>
                  <div style={{ color: "#4e4d6a", fontSize: "0.75rem", marginTop: "0.35rem" }}>
                    Actor: <span style={{ color: "#8b8aa8" }}>{event.actor}</span> · {formatDate(event.timestamp)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Pagination */}
        {data && (
          <div
            style={{
              padding: "0.85rem 1.75rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "rgba(255, 255, 255, 0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "#8b8aa8" }}>
              Showing {data.events.length} of {data.totalCount} events (Page {data.page} of {data.totalPages})
            </span>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                onClick={() => loadAuditData(page - 1, filterType)}
                disabled={page <= 1 || isPending}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: page <= 1 ? "#4e4d6a" : "#f1f0ff",
                  fontSize: "0.8rem",
                  cursor: page <= 1 || isPending ? "not-allowed" : "pointer",
                }}
              >
                ← Previous
              </button>
              <button
                onClick={() => loadAuditData(page + 1, filterType)}
                disabled={page >= data.totalPages || isPending}
                style={{
                  padding: "0.4rem 0.85rem",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: page >= data.totalPages ? "#4e4d6a" : "#f1f0ff",
                  fontSize: "0.8rem",
                  cursor: page >= data.totalPages || isPending ? "not-allowed" : "pointer",
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

"use client";

import { useState, useTransition } from "react";
import { getFullAuditTrail, FullAuditTrailResponse } from "@/app/actions/audit";
import styles from "../admin.module.css";

interface AuditTrailViewProps {
  initialData: FullAuditTrailResponse;
  initialFilter: string;
  initialPage: number;
}

const FILTER_TABS = [
  { key: "ALL", label: "All Activities" },
  { key: "TRANSFER", label: "Manual Transfers" },
  { key: "LEAD_INTAKE", label: "Lead Distribution" },
  { key: "STATUS_CHANGE", label: "Pipeline Status Changes" },
  { key: "TASK_COMPLETED", label: "Task Completions" },
];

function formatDate(d: string | Date): string {
  const date = new Date(d);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function AuditTrailView({ initialData, initialFilter, initialPage }: AuditTrailViewProps) {
  const [data, setData] = useState<FullAuditTrailResponse>(initialData);
  const [filterType, setFilterType] = useState(initialFilter);
  const [page, setPage] = useState(initialPage);
  const [isPending, startTx] = useTransition();

  function handleFilterChange(tabKey: string) {
    setFilterType(tabKey);
    startTx(async () => {
      try {
        const res = await getFullAuditTrail({ page: 1, pageSize: 15, filterType: tabKey });
        setData(res);
        setPage(1);
      } catch (err) {
        console.error("Failed to filter audit data:", err);
      }
    });
  }

  function handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > data.totalPages) return;
    startTx(async () => {
      try {
        const res = await getFullAuditTrail({ page: newPage, pageSize: 15, filterType });
        setData(res);
        setPage(newPage);
      } catch (err) {
        console.error("Failed to change page:", err);
      }
    });
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* ── Daily Agent Intake Summaries ── */}
      <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1rem", color: "#f1f0ff", marginBottom: "0.75rem", fontWeight: 700 }}>
          Today&apos;s Lead Intake by Agent
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "1rem",
          }}
        >
          {data.todayAgentSummaries.map((summary) => (
            <div
              key={summary.agentId}
              style={{
                background: "linear-gradient(135deg, rgba(20, 24, 39, 0.7) 0%, rgba(10, 14, 26, 0.7) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "1rem",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.2)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "#8b8aa8", fontWeight: 600, textTransform: "uppercase" }}>
                {summary.agentName}
              </div>
              <div style={{ fontSize: "1.35rem", color: "#20C997", fontWeight: 800, marginTop: "4px" }}>
                {summary.leadCountToday} leads today
              </div>
              <div style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "2px" }}>
                Dynamic round-robin intake
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Aggregate Counters ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div className={`${styles.statCard} ${styles.accentGreen}`}>
          <div className={styles.statValue}>{data.totalTransfers}</div>
          <div className={styles.statLabel}>Total Manual Transfers</div>
        </div>
        <div className={`${styles.statCard} ${styles.accentGold}`}>
          <div className={styles.statValue}>{data.totalStatusChanges}</div>
          <div className={styles.statLabel}>Status Transitions Logged</div>
        </div>
        <div className={`${styles.statCard} ${styles.accentPurple}`}>
          <div className={styles.statValue}>{data.totalCompletedTasks}</div>
          <div className={styles.statLabel}>Tasks Completed</div>
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1rem",
          overflowX: "auto",
          paddingBottom: "0.25rem",
        }}
      >
        {FILTER_TABS.map((tab) => {
          const active = filterType === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                border: active
                  ? "1px solid rgba(32, 201, 151, 0.5)"
                  : "1px solid rgba(255, 255, 255, 0.08)",
                background: active ? "rgba(32, 201, 151, 0.15)" : "rgba(255, 255, 255, 0.02)",
                color: active ? "#20C997" : "#8b8aa8",
                fontSize: "0.82rem",
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

      {/* ── Main Audit Table ── */}
      <div className={styles.tablePanel}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Activity Event</th>
                <th>Details & Metadata</th>
                <th>Actor</th>
                <th>Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={5}>Loading historical audit records...</td>
                </tr>
              ) : data.events.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={5}>No audit logs found for this filter.</td>
                </tr>
              ) : (
                data.events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span
                        style={{
                          padding: "0.2rem 0.55rem",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: `${ev.badgeColor}22`,
                          color: ev.badgeColor,
                          border: `1px solid ${ev.badgeColor}44`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ev.badgeText}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#f1f0ff", fontWeight: 700, fontSize: "0.9rem" }}>
                        {ev.title}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#8b8aa8", fontSize: "0.82rem" }}>
                        {ev.description}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#20C997", fontWeight: 600, fontSize: "0.82rem" }}>
                        {ev.actor}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#8b8aa8", fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                        {formatDate(ev.timestamp)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Controls ── */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#8b8aa8" }}>
            Showing page {data.page} of {data.totalPages} ({data.totalCount} total entries)
          </span>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1 || isPending}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: page <= 1 ? "#4e4d6a" : "#f1f0ff",
                fontSize: "0.82rem",
                cursor: page <= 1 || isPending ? "not-allowed" : "pointer",
              }}
            >
              ← Previous
            </button>
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= data.totalPages || isPending}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "6px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                color: page >= data.totalPages ? "#4e4d6a" : "#f1f0ff",
                fontSize: "0.82rem",
                cursor: page >= data.totalPages || isPending ? "not-allowed" : "pointer",
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

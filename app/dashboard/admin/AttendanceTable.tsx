"use client";

import styles from "./admin.module.css";

interface AttendanceRecord {
  id: string;
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentAvatar: string | null;
  languageGroup: string;
  date: string | Date;
  clockIn: string | Date;
  clockOut: string | Date | null;
  breakStart: string | Date | null;
  breakEnd: string | Date | null;
  status: string;
  totalBreakMinutes: number;
  totalWorkMinutes: number;
  formattedHours: string;
  formattedBreak: string;
}

interface AttendanceTableProps {
  records: AttendanceRecord[];
}

function formatClockTime(d: string | Date | null): string {
  if (!d) return "--:--";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function AttendanceTable({ records }: AttendanceTableProps) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(20, 24, 39, 0.7) 0%, rgba(10, 14, 26, 0.7) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.2rem",
          paddingBottom: "0.8rem",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              background: "#3b82f6",
              boxShadow: "0 0 10px #3b82f6",
              display: "inline-block",
            }}
          />
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f1f0ff", fontWeight: 700 }}>
            Agent Time & Attendance Daily Logs
          </h3>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>
          Live Hours & Break Tracking
        </span>
      </div>

      <div className={styles.tablePanel} style={{ border: "none", background: "transparent" }}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Break Time</th>
                <th>Hours Worked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr className={styles.emptyRow}>
                  <td colSpan={7}>No attendance records logged today yet.</td>
                </tr>
              ) : (
                records.map((rec) => {
                  let statusLabel = "Clocked Out";
                  let statusStyle = {
                    color: "#9ca3af",
                    bg: "rgba(156, 163, 175, 0.1)",
                    border: "rgba(156, 163, 175, 0.2)",
                  };

                  if (rec.status === "CLOCKED_IN") {
                    statusLabel = "🟢 Working";
                    statusStyle = {
                      color: "#20C997",
                      bg: "rgba(32, 201, 151, 0.15)",
                      border: "rgba(32, 201, 151, 0.3)",
                    };
                  } else if (rec.status === "ON_BREAK") {
                    statusLabel = "☕ On Break";
                    statusStyle = {
                      color: "#f59e0b",
                      bg: "rgba(245, 158, 11, 0.15)",
                      border: "rgba(245, 158, 11, 0.3)",
                    };
                  }

                  return (
                    <tr key={rec.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          {rec.agentAvatar ? (
                            <img
                              src={rec.agentAvatar}
                              alt={rec.agentName}
                              style={{ width: 28, height: 28, borderRadius: "50%" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                background: "#0a0e1a",
                                border: "1px solid #20C997",
                                color: "#20C997",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              {rec.agentName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ color: "#f1f0ff", fontWeight: 600, fontSize: "0.85rem" }}>
                              {rec.agentName}
                            </div>
                            <div style={{ color: "#8b8aa8", fontSize: "0.72rem" }}>
                              {rec.agentEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ color: "#8b8aa8", fontSize: "0.82rem" }}>
                          {formatDate(rec.date)}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: "#f1f0ff", fontWeight: 600, fontSize: "0.85rem" }}>
                          {formatClockTime(rec.clockIn)}
                        </span>
                      </td>

                      <td>
                        <span style={{ color: rec.clockOut ? "#f1f0ff" : "#8b8aa8", fontSize: "0.85rem" }}>
                          {rec.clockOut ? formatClockTime(rec.clockOut) : "In Progress"}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            color: rec.totalBreakMinutes > 0 ? "#f59e0b" : "#8b8aa8",
                            fontWeight: 600,
                            fontSize: "0.85rem",
                          }}
                        >
                          {rec.formattedBreak}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            color: "#20C997",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                          }}
                        >
                          {rec.formattedHours}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.6rem",
                            borderRadius: "99px",
                            color: statusStyle.color,
                            background: statusStyle.bg,
                            border: `1px solid ${statusStyle.border}`,
                            display: "inline-block",
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

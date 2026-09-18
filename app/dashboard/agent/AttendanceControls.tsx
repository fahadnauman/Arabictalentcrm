"use client";

import { useState, useTransition } from "react";
import {
  agentClockIn,
  agentClockOut,
  agentStartBreak,
  agentEndBreak,
} from "@/app/actions/attendance";
import { useRouter } from "next/navigation";

interface AttendanceState {
  id: string;
  status: string; // "CLOCKED_IN" | "ON_BREAK" | "CLOCKED_OUT"
  clockIn: string | Date;
  breakStart?: string | Date | null;
}

interface AttendanceControlsProps {
  initialAttendance: AttendanceState | null;
}

function formatTime(d: string | Date): string {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AttendanceControls({ initialAttendance }: AttendanceControlsProps) {
  const router = useRouter();
  const [attendance, setAttendance] = useState<AttendanceState | null>(initialAttendance);
  const [isPending, startTx] = useTransition();
  const [error, setError] = useState("");

  const status = attendance?.status || "CLOCKED_OUT";

  async function handleClockIn() {
    setError("");
    startTx(async () => {
      try {
        const res = await agentClockIn();
        if (res.attendance) {
          setAttendance({
            id: res.attendance.id,
            status: res.attendance.status,
            clockIn: res.attendance.clockIn,
          });
        }
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to clock in");
      }
    });
  }

  async function handleClockOut() {
    setError("");
    startTx(async () => {
      try {
        await agentClockOut();
        setAttendance(null);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to clock out");
      }
    });
  }

  async function handleStartBreak() {
    setError("");
    startTx(async () => {
      try {
        const res = await agentStartBreak();
        if (res.attendance) {
          setAttendance((prev) =>
            prev
              ? {
                  ...prev,
                  status: "ON_BREAK",
                  breakStart: res.attendance.breakStart,
                }
              : null
          );
        }
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to start break");
      }
    });
  }

  async function handleEndBreak() {
    setError("");
    startTx(async () => {
      try {
        const res = await agentEndBreak();
        if (res.attendance) {
          setAttendance((prev) =>
            prev
              ? {
                  ...prev,
                  status: "CLOCKED_IN",
                  breakStart: null,
                }
              : null
          );
        }
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to end break");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {error && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#f87171",
            background: "rgba(248, 113, 113, 0.1)",
            padding: "0.2rem 0.5rem",
            borderRadius: "4px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {status === "CLOCKED_OUT" ? (
          <button
            type="button"
            onClick={handleClockIn}
            disabled={isPending}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "20px",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: isPending ? "not-allowed" : "pointer",
              background: "rgba(32, 201, 151, 0.15)",
              color: "#20C997",
              border: "1px solid rgba(32, 201, 151, 0.4)",
              transition: "all 0.15s ease",
            }}
          >
            {isPending ? "Updating..." : "▶ Clock In"}
          </button>
        ) : (
          <>
            {status === "CLOCKED_IN" ? (
              <button
                type="button"
                onClick={handleStartBreak}
                disabled={isPending}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "20px",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  cursor: isPending ? "not-allowed" : "pointer",
                  background: "rgba(245, 158, 11, 0.15)",
                  color: "#f59e0b",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                ☕ Take Break
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEndBreak}
                disabled={isPending}
                style={{
                  padding: "0.4rem 0.8rem",
                  borderRadius: "20px",
                  fontWeight: 600,
                  fontSize: "0.78rem",
                  cursor: isPending ? "not-allowed" : "pointer",
                  background: "rgba(32, 201, 151, 0.15)",
                  color: "#20C997",
                  border: "1px solid rgba(32, 201, 151, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                ✓ Resume Work
              </button>
            )}

            <button
              type="button"
              onClick={handleClockOut}
              disabled={isPending}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "20px",
                fontWeight: 600,
                fontSize: "0.78rem",
                cursor: isPending ? "not-allowed" : "pointer",
                background: "rgba(248, 113, 113, 0.15)",
                color: "#f87171",
                border: "1px solid rgba(248, 113, 113, 0.4)",
                transition: "all 0.15s ease",
              }}
            >
              ⏹ Clock Out
            </button>
          </>
        )}
      </div>

      {attendance && (
        <div style={{ fontSize: "0.7rem", color: "#8b8aa8", textAlign: "right" }}>
          {status === "ON_BREAK" ? (
            <span style={{ color: "#f59e0b" }}>
              ☕ On break {attendance.breakStart ? `since ${formatTime(attendance.breakStart)}` : ""}
            </span>
          ) : (
            <span style={{ color: "#20C997" }}>
              🟢 Working since {formatTime(attendance.clockIn)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

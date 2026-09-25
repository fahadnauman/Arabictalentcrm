"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./agent.module.css";

interface InteractiveTotalLeadsCardProps {
  totalLeads: number;
  temperatureBreakdown: { HOT: number; WARM: number; COLD: number };
}

export function InteractiveTotalLeadsCard({
  totalLeads,
  temperatureBreakdown,
}: InteractiveTotalLeadsCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/agent/inbox")}
      className={`${styles.statCard} flex flex-col justify-between transition-all duration-200 ease-out`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.borderColor = "rgba(167, 139, 250, 0.4)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(124, 58, 237, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.boxShadow = "";
      }}
      title="View all leads in Inbox"
    >
      <div>
        <div className={`${styles.statVal} ${styles.purpleVal}`}>{totalLeads}</div>
        <div className={styles.statLbl}>Total Leads Joined</div>
      </div>
      <div
        className="flex flex-row items-center gap-1.5 flex-wrap"
        style={{
          display: "flex",
          gap: "0.35rem",
          marginTop: "0.5rem",
          fontSize: "0.65rem",
          fontWeight: 700,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#f87171" }} title="Hot Leads">🔥 {temperatureBreakdown.HOT}</span>
        <span style={{ color: "#fbbf24" }} title="Warm Leads">☀️ {temperatureBreakdown.WARM}</span>
        <span style={{ color: "#38bdf8" }} title="Cold Leads">❄️ {temperatureBreakdown.COLD}</span>
      </div>
    </div>
  );
}

interface InteractiveFollowUpLeadsCardProps {
  count: number;
}

export function InteractiveFollowUpLeadsCard({ count }: InteractiveFollowUpLeadsCardProps) {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/dashboard/agent/inbox?filter=follow-up")}
      className={`${styles.statCard} flex flex-col justify-between transition-all duration-200 ease-out`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.borderColor = "rgba(251, 146, 60, 0.5)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(251, 146, 60, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.boxShadow = "";
      }}
      title="View follow-up leads in Inbox"
    >
      <div>
        <div className={styles.statVal} style={{ color: "#fb923c" }}>{count}</div>
        <div className={styles.statLbl}>Follow-Up Leads</div>
      </div>
      <span style={{ fontSize: "0.68rem", color: "#8b8aa8", marginTop: "0.5rem" }}>
        Active scheduling ➔
      </span>
    </div>
  );
}

interface LiveNewLeadsStatCardProps {
  initialCount: number;
}

export function LiveNewLeadsStatCard({ initialCount }: LiveNewLeadsStatCardProps) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    function handleNewLead() {
      setCount((prev) => prev + 1);
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2500);
    }

    window.addEventListener("new-lead-received", handleNewLead);
    return () => window.removeEventListener("new-lead-received", handleNewLead);
  }, []);

  return (
    <div
      onClick={() => router.push("/dashboard/agent/inbox?filter=new")}
      className={`${styles.statCard} flex flex-col justify-between transition-all duration-200 ease-out`}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        borderColor: highlight ? "#60a5fa" : undefined,
        boxShadow: highlight ? "0 0 16px rgba(96, 165, 250, 0.4)" : undefined,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.02)";
        e.currentTarget.style.borderColor = "rgba(96, 165, 250, 0.5)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(96, 165, 250, 0.25)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = highlight ? "#60a5fa" : "";
        e.currentTarget.style.boxShadow = highlight ? "0 0 16px rgba(96, 165, 250, 0.4)" : "";
      }}
      title="View new leads in Inbox"
    >
      <div>
        <div
          className={styles.statVal}
          style={{
            color: "#60a5fa",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <span>{count}</span>
          {highlight && (
            <span
              style={{
                fontSize: "0.7rem",
                color: "#20C997",
                background: "rgba(32, 201, 151, 0.15)",
                padding: "0.1rem 0.35rem",
                borderRadius: "4px",
              }}
            >
              +1
            </span>
          )}
        </div>
        <div className={styles.statLbl}>New Leads</div>
      </div>
      <span style={{ fontSize: "0.68rem", color: "#8b8aa8", marginTop: "0.5rem" }}>
        Fresh in pipeline ➔
      </span>
    </div>
  );
}

interface LiveTodayNewLeadsCardProps {
  initialCount: number;
}

export function LiveTodayNewLeadsCard({ initialCount }: LiveTodayNewLeadsCardProps) {
  const [count, setCount] = useState(initialCount);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    function handleNewLead() {
      setCount((prev) => prev + 1);
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2500);
    }

    window.addEventListener("new-lead-received", handleNewLead);
    return () => window.removeEventListener("new-lead-received", handleNewLead);
  }, []);

  return (
    <div
      style={{
        background: highlight ? "rgba(96, 165, 250, 0.18)" : "rgba(96, 165, 250, 0.08)",
        border: highlight ? "1px solid #60a5fa" : "1px solid rgba(96, 165, 250, 0.2)",
        borderRadius: "10px",
        padding: "0.75rem",
        textAlign: "center",
        transition: "all 0.3s ease",
        boxShadow: highlight ? "0 0 16px rgba(96, 165, 250, 0.3)" : "none",
      }}
    >
      <div
        style={{
          fontSize: "1.3rem",
          fontWeight: 800,
          color: "#60a5fa",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.3rem",
        }}
      >
        <span>{count}</span>
        {highlight && (
          <span
            style={{
              fontSize: "0.7rem",
              color: "#20C997",
              fontWeight: 700,
            }}
          >
            +1
          </span>
        )}
      </div>
      <div style={{ fontSize: "0.7rem", color: "#d1d5db", fontWeight: 600, marginTop: "0.15rem" }}>
        Today&apos;s New Leads
      </div>
    </div>
  );
}

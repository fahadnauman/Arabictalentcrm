"use client";

import { useEffect, useState } from "react";
import styles from "./agent.module.css";

interface LiveNewLeadsStatCardProps {
  initialCount: number;
}

export function LiveNewLeadsStatCard({ initialCount }: LiveNewLeadsStatCardProps) {
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
      className={styles.statCard}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transition: "all 0.3s ease",
        borderColor: highlight ? "#60a5fa" : undefined,
        boxShadow: highlight ? "0 0 16px rgba(96, 165, 250, 0.4)" : undefined,
      }}
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
        Fresh in pipeline
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

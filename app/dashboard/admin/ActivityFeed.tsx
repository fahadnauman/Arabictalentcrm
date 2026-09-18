"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";

interface ActivityItem {
  id: string;
  type: "TRANSFER" | "ASSIGNMENT" | "TASK" | "SYSTEM";
  message: string;
  actorName: string;
  occurredAt: string | Date;
}

function timeAgo(date: string | Date): string {
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ initialItems }: { initialItems: ActivityItem[] }) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems);

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
              background: "#20C997",
              boxShadow: "0 0 10px #20C997",
              display: "inline-block",
            }}
          />
          <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f1f0ff", fontWeight: 700 }}>
            Live Lead Activity Feed
          </h3>
        </div>
        <span style={{ fontSize: "0.75rem", color: "#8b8aa8", fontWeight: 500 }}>
          Real-Time Audit Trail
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          maxHeight: "340px",
          overflowY: "auto",
        }}
      >
        {items.length === 0 ? (
          <div style={{ color: "#8b8aa8", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem" }}>
            No recent transfer or assignment activities yet.
          </div>
        ) : (
          items.map((item) => {
            const isTransfer = item.type === "TRANSFER";
            const iconBg = isTransfer ? "rgba(32, 201, 151, 0.15)" : "rgba(0, 255, 255, 0.12)";
            const iconColor = isTransfer ? "#20C997" : "#00ffff";
            const borderColor = isTransfer ? "rgba(32, 201, 151, 0.25)" : "rgba(0, 255, 255, 0.2)";

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 1rem",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: "10px",
                  gap: "1rem",
                  transition: "background 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                  <span
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: iconBg,
                      color: iconColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1rem",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isTransfer ? "🟢" : "🔵"}
                  </span>
                  <div>
                    <div style={{ color: "#f1f0ff", fontSize: "0.85rem", fontWeight: 600 }}>
                      {item.message}
                    </div>
                    <div style={{ color: "#8b8aa8", fontSize: "0.72rem", marginTop: "2px" }}>
                      Logged by {item.actorName}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#8b8aa8",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeAgo(item.occurredAt)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import styles from "../../agent.module.css";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Chat Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className={styles.shell} style={{ display: "flex", flexDirection: "column", height: "100dvh", padding: "2rem", justifyContent: "center", alignItems: "center", textAlign: "center", background: "#0e0d17", color: "#ffffff" }}>
      <h2 style={{ color: "#f87171", marginBottom: "1rem" }}>A Client-Side Crash Occurred</h2>
      <div style={{ background: "rgba(248,113,113,0.1)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.3)", maxWidth: "100%", overflowX: "auto", textAlign: "left", marginBottom: "1.5rem" }}>
        <p style={{ fontWeight: 600, color: "#fca5a5" }}>{error.name}: {error.message}</p>
        {error.stack && (
          <pre style={{ fontSize: "0.75rem", color: "#fecaca", marginTop: "1rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {error.stack}
          </pre>
        )}
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          onClick={() => reset()}
          style={{ background: "#20C997", color: "#000", border: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}
        >
          Try Again
        </button>
        <Link href="/dashboard/agent/inbox" style={{ background: "rgba(255,255,255,0.1)", color: "#fff", textDecoration: "none", padding: "0.5rem 1rem", borderRadius: "8px", fontWeight: 600 }}>
          Back to Inbox
        </Link>
      </div>
    </div>
  );
}

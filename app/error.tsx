"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", background: "#0a0e1a", color: "#f1f0ff", padding: "2rem", textAlign: "center"
    }}>
      <div style={{
        background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)",
        borderRadius: "16px", padding: "3rem 2rem", maxWidth: "500px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}>
        <h2 style={{ fontSize: "1.5rem", color: "#f87171", marginBottom: "1rem", marginTop: 0 }}>Something went wrong!</h2>
        <p style={{ color: "#8b8aa8", fontSize: "0.9rem", marginBottom: "2rem", lineHeight: 1.5 }}>
          We encountered an unexpected error. Please try reloading the page or return to the dashboard.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.75rem 1.5rem", borderRadius: "8px", border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.1)", color: "white", fontWeight: 700
            }}
          >
            Try again
          </button>
          <Link href="/dashboard/agent" style={{
            padding: "0.75rem 1.5rem", borderRadius: "8px", textDecoration: "none",
            background: "linear-gradient(135deg, #20C997, #138562)", color: "white", fontWeight: 700
          }}>
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

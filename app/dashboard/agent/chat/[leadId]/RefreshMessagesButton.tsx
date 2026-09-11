"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RefreshMessagesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSpinning, setIsSpinning] = useState(false);

  function handleRefresh() {
    setIsSpinning(true);
    startTransition(() => {
      router.refresh();
    });
    // Ensure smooth visual rotation feedback
    setTimeout(() => {
      setIsSpinning(false);
    }, 700);
  }

  const loading = isPending || isSpinning;

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        padding: "0.32rem 0.75rem",
        borderRadius: "8px",
        fontSize: "0.72rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        color: loading ? "#20C997" : "#d1d0e4",
        background: loading ? "rgba(32, 201, 151, 0.15)" : "rgba(255, 255, 255, 0.05)",
        border: `1px solid ${loading ? "rgba(32, 201, 151, 0.4)" : "rgba(255, 255, 255, 0.12)"}`,
        cursor: loading ? "wait" : "pointer",
        transition: "all 0.2s ease",
        flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      }}
      title="Fetch newest WhatsApp messages and lead status updates"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transformOrigin: "center",
          animation: loading ? "spin 0.75s linear infinite" : "none",
        }}
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6" />
        <path d="M21.5 8a9 9 0 0 0-16.14-3.86L2.5 8M2.5 16a9 9 0 0 0 16.14 3.86L21.5 16" />
      </svg>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <span>{loading ? "Refreshing…" : "Refresh Messages"}</span>
    </button>
  );
}

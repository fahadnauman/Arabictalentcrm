"use client";

import { useState } from "react";
import Link from "next/link";
import AddAgentModal from "./AddAgentModal";

export default function AdminActions() {
  const [isAgentModalOpen, setAgentModalOpen] = useState(false);
  const [isMenuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", position: "relative" }}>
      
      {/* Primary Action: Add Agent */}
      <button 
        onClick={() => setAgentModalOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          padding: "0.5rem 1.1rem", borderRadius: "8px", border: "none", cursor: "pointer",
          background: "linear-gradient(135deg, #20C997, #138562)",
          color: "white", fontSize: "0.82rem", fontWeight: 700,
          boxShadow: "0 3px 12px rgba(32,201,151,0.3)",
          transition: "transform 0.15s",
        }}
      >
        + Add Agent
      </button>

      {/* Secondary Action Menu */}
      <div style={{ position: "relative" }}>
        <button 
          onClick={() => setMenuOpen(!isMenuOpen)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            padding: "0.5rem 1.1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.05)", cursor: "pointer",
            color: "#f1f0ff", fontSize: "0.82rem", fontWeight: 700,
          }}
        >
          Quick Actions ▾
        </button>

        {isMenuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{
              position: "absolute", top: "calc(100% + 0.5rem)", right: 0, zIndex: 50,
              background: "#0f1428", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px", padding: "0.5rem", minWidth: "160px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)", animation: "fadeIn 0.15s ease"
            }}>
              <Link 
                href="/dashboard/admin/leads/new" 
                style={{
                  display: "block", padding: "0.6rem 0.8rem", color: "#f1f0ff",
                  textDecoration: "none", fontSize: "0.85rem", borderRadius: "6px",
                  transition: "background 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                + Add Manual Lead
              </Link>
            </div>
          </>
        )}
      </div>

      <AddAgentModal isOpen={isAgentModalOpen} onClose={() => setAgentModalOpen(false)} />
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

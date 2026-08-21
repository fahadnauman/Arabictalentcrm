"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { createAgent } from "@/app/actions/agent";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function AddAgentModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTx] = useTransition();
  const [error, setError] = useState("");
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [successData, setSuccessData] = useState<{ password: string } | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setName(""); setEmail(""); setPhone(""); setIsActive(true);
      setError(""); setSuccessData(null);
    }
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    startTx(async () => {
      try {
        const res = await createAgent({ name, email, phone, isActive });
        setSuccessData({ password: res.tempPassword });
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Something went wrong.");
      }
    });
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(10, 14, 26, 0.85)", backdropFilter: "blur(5px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
    }}>
      <div style={{
        background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
        border: "1px solid rgba(32,201,151,0.2)",
        borderRadius: "16px", width: "100%", maxWidth: "450px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.6), 0 0 40px rgba(32,201,151,0.1)",
        overflow: "hidden", animation: "modalIn 0.3s ease"
      }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <h3 style={{ margin: 0, color: "#f1f0ff", fontSize: "1.1rem", fontWeight: 700 }}>Add New Agent</h3>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "#8b8aa8", fontSize: "1.2rem", cursor: "pointer"
          }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem" }}>
          {successData ? (
            <div style={{ textAlign: "center", padding: "1rem 0" }}>
              <div style={{ 
                width: "60px", height: "60px", background: "rgba(32,201,151,0.1)", color: "#20C997",
                borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "2rem", margin: "0 auto 1.5rem"
              }}>✓</div>
              <h4 style={{ color: "#f1f0ff", fontSize: "1.2rem", margin: "0 0 0.5rem" }}>Agent Created!</h4>
              <p style={{ color: "#8b8aa8", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
                Share these login details securely. The agent will use their email to log in.
              </p>
              
              <div style={{ 
                background: "#0a0e1a", border: "1px dashed rgba(32,201,151,0.4)", borderRadius: "8px",
                padding: "1rem", marginBottom: "1.5rem", display: "inline-block", textAlign: "left"
              }}>
                <div style={{ color: "#8b8aa8", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.25rem" }}>Temporary Password</div>
                <div style={{ color: "#20C997", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "2px" }}>
                  {successData.password}
                </div>
              </div>

              <button onClick={onClose} style={{
                width: "100%", padding: "0.85rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#f1f0ff", borderRadius: "8px", fontWeight: 700, cursor: "pointer"
              }}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b8aa8", textTransform: "uppercase" }}>Agent Name</label>
                <input value={name} onChange={e => setName(e.target.value)} required style={inputSty} placeholder="e.g. Sarah Connor" disabled={isPending} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b8aa8", textTransform: "uppercase" }}>Email (Login ID)</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputSty} placeholder="agent@arabictalent.com" disabled={isPending} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "#8b8aa8", textTransform: "uppercase" }}>Phone Number</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={inputSty} placeholder="+971..." disabled={isPending} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", background: "rgba(255,255,255,0.02)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f1f0ff" }}>Active Status</div>
                  <div style={{ fontSize: "0.7rem", color: "#8b8aa8", marginTop: "2px" }}>Eligible for new lead assignments</div>
                </div>
                
                {/* Toggle Switch */}
                <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                  <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} disabled={isPending} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span style={{
                    position: "absolute", cursor: "pointer", inset: 0, borderRadius: "24px",
                    background: isActive ? "#20C997" : "rgba(255,255,255,0.1)", transition: "0.3s"
                  }}>
                    <span style={{
                      position: "absolute", height: "18px", width: "18px", left: isActive ? "22px" : "3px", bottom: "3px",
                      background: "white", borderRadius: "50%", transition: "0.3s"
                    }} />
                  </span>
                </label>
              </div>

              {error && <div style={{ color: "#f87171", fontSize: "0.85rem", background: "rgba(248,113,113,0.1)", padding: "0.75rem", borderRadius: "8px" }}>{error}</div>}

              <button type="submit" disabled={isPending} style={{
                background: "linear-gradient(135deg, #20C997, #138562)", color: "#fff", fontWeight: 700, 
                padding: "0.85rem", borderRadius: "8px", border: "none", cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1, marginTop: "0.5rem"
              }}>
                {isPending ? "Creating Agent..." : "Create Agent"}
              </button>
            </form>
          )}
        </div>
        
        <style>{`
          @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        `}</style>
      </div>
    </div>,
    document.body
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px", padding: "0.75rem 1rem", color: "#f1f0ff", fontSize: "0.95rem",
  fontFamily: "inherit", outline: "none", boxSizing: "border-box"
};

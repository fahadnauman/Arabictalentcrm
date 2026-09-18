"use client";

import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { updateAgentProfile } from "@/app/actions/agent";

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    languageGroup: string;
    isActive: boolean;
  };
}

export default function EditAgentModal({ isOpen, onClose, agent }: EditAgentModalProps) {
  const router = useRouter();
  const [isPending, startTx] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [name, setName] = useState(agent.name);
  const [email, setEmail] = useState(agent.email);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(agent.phone || "");
  const [languageGroup, setLanguageGroup] = useState(agent.languageGroup || "ENGLISH");
  const [isActive, setIsActive] = useState(agent.isActive);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) {
      setName(agent.name);
      setEmail(agent.email);
      setPassword("");
      setPhone(agent.phone || "");
      setLanguageGroup(agent.languageGroup || "ENGLISH");
      setIsActive(agent.isActive);
      setError("");
      setSuccess(false);
    }
  }, [isOpen, agent]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    if (!email.trim()) {
      setError("Email cannot be empty.");
      return;
    }
    if (password.trim() && password.trim().length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    startTx(async () => {
      try {
        await updateAgentProfile({
          agentId: agent.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password.trim() || undefined,
          phone: phone.trim() || undefined,
          languageGroup,
          isActive,
        });

        setSuccess(true);
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 1200);
      } catch (err: any) {
        setError(err.message || "Failed to update agent profile.");
      }
    });
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(10, 14, 26, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div
        style={{
          background: "linear-gradient(180deg, #111827 0%, #0a0e1a 100%)",
          border: "1px solid rgba(32, 201, 151, 0.3)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(32,201,151,0.15)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: "#f1f0ff", fontSize: "1.15rem", fontWeight: 700 }}>
              Edit Agent Profile
            </h3>
            <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>
              ID: {agent.id}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              background: "transparent",
              border: "none",
              color: "#8b8aa8",
              fontSize: "1.25rem",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          {error && (
            <div
              style={{
                background: "rgba(248, 113, 113, 0.15)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                borderRadius: "8px",
                padding: "0.75rem",
                color: "#f87171",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "rgba(32, 201, 151, 0.15)",
                border: "1px solid rgba(32, 201, 151, 0.3)",
                borderRadius: "8px",
                padding: "0.75rem",
                color: "#20C997",
                fontSize: "0.85rem",
                marginBottom: "1.25rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              ✓ Agent profile updated successfully! Refreshing...
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label
                style={{
                  display: "block",
                  color: "#8b8aa8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "#f1f0ff",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  color: "#8b8aa8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                Email Address (Login ID)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "#f1f0ff",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: "0.72rem", color: "#6b7280", marginTop: "3px", display: "block" }}>
                Preserves all assigned leads and message history safely.
              </span>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  color: "#8b8aa8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "0.35rem",
                }}
              >
                New Password (Optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.85rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "8px",
                  color: "#f1f0ff",
                  fontSize: "0.9rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    color: "#8b8aa8",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Language Pool
                </label>
                <select
                  value={languageGroup}
                  onChange={(e) => setLanguageGroup(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    background: "#0d1322",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    color: "#f1f0ff",
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="ENGLISH">ENGLISH</option>
                  <option value="MALAYALAM">MALAYALAM</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    color: "#8b8aa8",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    marginBottom: "0.35rem",
                  }}
                >
                  Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971..."
                  style={{
                    width: "100%",
                    padding: "0.65rem 0.85rem",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    color: "#f1f0ff",
                    fontSize: "0.9rem",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
                marginTop: "0.25rem",
              }}
            >
              <div>
                <div style={{ color: "#f1f0ff", fontSize: "0.85rem", fontWeight: 600 }}>
                  Active in Round Robin
                </div>
                <div style={{ color: "#8b8aa8", fontSize: "0.75rem" }}>
                  Eligible to receive new incoming leads
                </div>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                style={{ width: "18px", height: "18px", accentColor: "#20C997", cursor: "pointer" }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.75rem",
              marginTop: "1.75rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "8px",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#8b8aa8",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "0.6rem 1.4rem",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #20C997 0%, #00b4d8 100%)",
                border: "none",
                color: "#0a0e1a",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.7 : 1,
              }}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

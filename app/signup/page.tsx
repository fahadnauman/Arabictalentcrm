"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "../login/login.module.css"; // Reuse the dark green login styling

// ── Inline SVG icons ───────────────────────────────────────────────────────
const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────
export default function SignupPage() {
  const router = useRouter();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus]     = useState<"idle" | "loading" | "success">("idle");
  const [error, setError]       = useState<string | null>(null);

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setStatus("loading");

    try {
      // Calling our registration endpoint
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Registration failed. Please try again.");
        setStatus("idle");
        return;
      }

      setStatus("success");

      // Redirect after a short moment
      setTimeout(() => {
        router.push("/dashboard/agent");
      }, 1800);
    } catch {
      setError("Unable to reach the server. Check your connection.");
      setStatus("idle");
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>

        {/* ── Logo ──────────────────────────────────────────────────── */}
        <div className={styles.logoWrap}>
          <div className={styles.logoArea} style={{ display: "flex", justifyContent: "center" }}>
            <img src="/logo.png" alt="Arabic Talent" style={{ width: 260, height: "auto", objectFit: "contain", marginBottom: "1.5rem", filter: "drop-shadow(0 0 16px rgba(32, 201, 151, 0.2))" }} />
          </div>
        </div>

        {/* ── Headings ──────────────────────────────────────────────── */}
        <h1 className={styles.title}>Create an Account</h1>
        <p className={styles.subtitle}>Sign up to join the sales team</p>

        <div className={styles.divider} />

        {/* ── Success state ─────────────────────────────────────────── */}
        {isSuccess && (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>✓ &nbsp;Account created!</p>
            <p className={styles.redirectNote}>Logging you in…</p>
          </div>
        )}

        {/* ── Sign up form ──────────────────────────────────────────── */}
        {!isSuccess && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            {error && (
              <div className={styles.errorBox}>
                <span className={styles.errorIcon}><IconAlert /></span>
                {error}
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label htmlFor="name" className={styles.label}>Full Name</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconUser /></span>
                <input
                  id="name"
                  type="text"
                  className={styles.input}
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>Email address</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconMail /></span>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="you@arabictalent.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconLock /></span>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || !email || !password || !name}
            >
              <span className={styles.btnContent}>
                {isLoading ? (
                  <>
                    <span className={styles.spinner} />
                    Creating account…
                  </>
                ) : (
                  "Sign up"
                )}
              </span>
            </button>

            <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "#8b8aa8" }}>
              Already have an account? <Link href="/login" style={{ color: "#20C997", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>
        )}

        <div className={styles.footer} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <span>Arabic Talent CRM &nbsp;·&nbsp; Powered by</span>
          <span style={{ fontWeight: 800, background: "var(--accent-1)", color: "#000", padding: "1px 5px", borderRadius: "4px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>N</span>
          <span style={{ fontWeight: 600 }}>NaumanLabs</span>
        </div>

      </div>
    </main>
  );
}

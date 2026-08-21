"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./login.module.css";

// ── Inline SVG icons (no extra dependency needed) ─────────────────────────
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

const IconAlert = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const IconShield = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L3 6v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V6l-9-4z"/>
  </svg>
);

const IconCrm = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

// ── Types ────────────────────────────────────────────────────────────────
type LoginState = "idle" | "loading" | "success";

interface LoggedInUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "AGENT";
}

// ── Component ────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus]     = useState<LoginState>("idle");
  const [error, setError]       = useState<string | null>(null);
  const [user, setUser]         = useState<LoggedInUser | null>(null);

  const isLoading = status === "loading";
  const isSuccess = status === "success";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setError(null);
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        setStatus("idle");
        return;
      }

      // ── Success ──
      setUser(data.user);
      setStatus("success");

      // Redirect after a short moment so the user sees their role
      setTimeout(() => {
        // In Step 4 these will be real dashboard routes
        if (data.user.role === "ADMIN") {
          router.push("/dashboard/admin");
        } else {
          router.push("/dashboard/agent");
        }
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
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Sign in to access your workspace</p>

        <div className={styles.divider} />

        {/* ── Success state ─────────────────────────────────────────── */}
        {isSuccess && user && (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>✓ &nbsp;Signed in as {user.name}</p>
            <span className={`${styles.roleBadge} ${user.role === "ADMIN" ? styles.roleBadgeAdmin : styles.roleBadgeAgent}`}>
              <IconShield />
              {user.role === "ADMIN" ? "Administrator" : "Sales Agent"}
            </span>
            <p className={styles.redirectNote}>Redirecting to your dashboard…</p>
          </div>
        )}

        {/* ── Login form ────────────────────────────────────────────── */}
        {!isSuccess && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>

            {/* Error banner */}
            {error && (
              <div className={styles.errorBox}>
                <span className={styles.errorIcon}><IconAlert /></span>
                {error}
              </div>
            )}

            {/* Email */}
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
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
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
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className={styles.submitBtn}
              disabled={isLoading || !email || !password}
            >
              <span className={styles.btnContent}>
                {isLoading ? (
                  <>
                    <span className={styles.spinner} />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </span>
            </button>

            <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8rem", color: "#8b8aa8" }}>
              Don't have an account? <Link href="/signup" style={{ color: "#20C997", textDecoration: "none", fontWeight: 600 }}>Sign up</Link>
            </p>
          </form>
        )}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <p className={styles.footer}>
          Arabic Talent CRM &nbsp;·&nbsp; Powered by Nauman Labs
        </p>

      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateLeadInfo } from "@/app/actions/lead";
import { useRouter } from "next/navigation";

interface Lead {
  id:         string;
  name:       string;
  phone:      string;
  company:    string | null;
  profession: string | null;
  country:    string | null;
  courseType: string | null;
  status:     string;
  paymentStatus: string | null;
  notes:      string | null;
  dealValueCents: bigint | null;
}

const STATUS_OPTIONS = ["NEW_LEAD", "INTERESTED", "NO_RESPONSE", "NOT_INTERESTED", "WAITING_FOR_PAYMENT", "CLOSED"];
const PAYMENT_OPTIONS = ["PENDING", "PARTIAL", "FULL"];

export default function PortfolioForm({ lead, userRole }: { lead: Lead; userRole: string }) {
  const router = useRouter();
  const [isPending, startTx] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Form State
  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [profession, setProfession] = useState(lead.profession || "");
  const [country, setCountry] = useState(lead.country || "");
  const [status, setStatus] = useState(lead.status);
  
  // Conditional Revenue State
  const [courseType, setCourseType] = useState(lead.courseType || "");
  const [paymentStatus, setPaymentStatus] = useState(lead.paymentStatus || "PENDING");
  const [amountPaid, setAmountPaid] = useState<number | "">(
    lead.dealValueCents ? Number(lead.dealValueCents) / 100 : ""
  );

  const isJoined = status === "CLOSED" || status === "WAITING_FOR_PAYMENT";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    startTx(async () => {
      try {
        await updateLeadInfo(lead.id, {
          name,
          phone,
          profession,
          country,
          status,
          courseType: isJoined ? courseType : undefined,
          amountPaid: isJoined && amountPaid !== "" ? Number(amountPaid) : undefined,
          paymentStatus: isJoined ? paymentStatus : undefined,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        router.refresh();
      } catch (err: any) {
        setError(err.message || "Failed to update portfolio.");
      }
    });
  }

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <FormField label="Full Name">
          <input value={name} onChange={e => setName(e.target.value)} style={inputSty} required />
        </FormField>
        <FormField label="Phone Number">
          <input value={phone} onChange={e => setPhone(e.target.value)} style={inputSty} required />
        </FormField>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <FormField label="Profession">
          <input value={profession} onChange={e => setProfession(e.target.value)} style={inputSty} placeholder="e.g. Engineer" />
        </FormField>
        <FormField label="Country">
          <input value={country} onChange={e => setCountry(e.target.value)} style={inputSty} placeholder="e.g. UAE" />
        </FormField>
      </div>

      <FormField label="Course Status">
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputSty, cursor: "pointer", appearance: "auto" }}>
          {STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt} style={{ background: "#0a0e1a" }}>
              {opt === "CLOSED" ? "Joined / Closed" : opt.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </FormField>

      {/* Conditional Fields */}
      {isJoined && (
        <div style={{ 
          background: "rgba(32,201,151,0.05)", border: "1px solid rgba(32,201,151,0.2)", 
          borderRadius: "12px", padding: "1.5rem", marginTop: "0.5rem",
          display: "flex", flexDirection: "column", gap: "1.25rem",
          animation: "fadeIn 0.3s ease"
        }}>
          <h4 style={{ margin: 0, color: "#20C997", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Revenue Processing</h4>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <FormField label="Type of Course Taken">
              <input value={courseType} onChange={e => setCourseType(e.target.value)} style={inputSty} placeholder="e.g. Business Arabic" required={isJoined} />
            </FormField>
            <FormField label="Payment Status">
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={{ ...inputSty, cursor: "pointer", appearance: "auto", color: "#20C997", fontWeight: 700 }}>
                {PAYMENT_OPTIONS.map(opt => (
                  <option key={opt} value={opt} style={{ background: "#0a0e1a" }}>
                    {opt}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            <FormField label="Amount Paid (AED)">
              <input 
                type="number" step="0.01" min="0" 
                value={amountPaid} onChange={e => setAmountPaid(e.target.value === "" ? "" : Number(e.target.value))} 
                style={{ ...inputSty, color: "#20C997", fontWeight: 700 }} 
                placeholder="0.00" required={isJoined} 
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Error & Success Messages */}
      {error && <div style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", padding: "1rem", borderRadius: "8px" }}>{error}</div>}
      {saved && <div style={{ color: "#20C997", background: "rgba(32,201,151,0.1)", padding: "1rem", borderRadius: "8px" }}>✓ Portfolio synced successfully!</div>}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
        <button type="submit" disabled={isPending} style={{
          background: "linear-gradient(135deg, #20C997, #138562)",
          color: "#fff", fontWeight: 700, padding: "0.85rem 2.5rem",
          borderRadius: "8px", border: "none", cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.7 : 1, boxShadow: "0 4px 14px rgba(32,201,151,0.3)"
        }}>
          {isPending ? "Syncing..." : "Save Portfolio"}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </form>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <label style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#8b8aa8" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputSty: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
  padding: "0.8rem 1rem", color: "#f0f0ff", fontSize: "0.95rem",
  fontFamily: "inherit", outline: "none", transition: "border-color 0.2s"
};

"use client";

import { useEffect, useState } from "react";

interface CurrencyData {
  base: string;
  rates: {
    AED: number;
    SAR: number;
    QAR: number;
    OMR: number;
    USD?: number;
  };
  source: string;
  lastUpdated: string;
}

const DEFAULT_RATES: CurrencyData = {
  base: "INR",
  rates: {
    AED: 23.55,
    SAR: 23.07,
    QAR: 23.76,
    OMR: 224.68,
    USD: 86.50,
  },
  source: "pegged_inr_parity",
  lastUpdated: new Date().toISOString(),
};

export default function CurrencyWidget() {
  const [data, setData] = useState<CurrencyData>(DEFAULT_RATES);
  const [loading, setLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<"AED" | "SAR" | "QAR" | "OMR">("AED");
  const [gccAmount, setGccAmount] = useState<string>("1000");

  async function fetchRates() {
    setLoading(true);
    try {
      const res = await fetch("/api/currency");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.warn("Currency fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRates();
  }, []);

  const numAmount = parseFloat(gccAmount) || 0;
  const currentRate = data.rates[selectedCurrency] || DEFAULT_RATES.rates[selectedCurrency];
  const convertedINR = (numAmount * currentRate).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(20, 24, 39, 0.7) 0%, rgba(10, 14, 26, 0.7) 100%)",
        border: "1px solid rgba(250, 204, 21, 0.25)",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(250, 204, 21, 0.05)",
      }}
    >
      {/* Header */}
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
          <span style={{ fontSize: "1.25rem" }}>🇮🇳</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f1f0ff", fontWeight: 700 }}>
              GCC to INR Currency Matrix
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#facc15", fontWeight: 600 }}>
              Base Comparison Currency: Indian Rupee (INR ₹)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchRates}
          disabled={loading}
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#8b8aa8",
            fontSize: "0.75rem",
            padding: "0.3rem 0.65rem",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
          title="Refresh rates"
        >
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>

      {/* GCC Exchange Rates Directly Against INR */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        {/* AED to INR */}
        <div
          style={{
            background: "rgba(32, 201, 151, 0.08)",
            border: "1px solid rgba(32, 201, 151, 0.3)",
            borderRadius: "12px",
            padding: "0.85rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>🇦🇪</div>
          <div style={{ fontSize: "0.72rem", color: "#8b8aa8", textTransform: "uppercase", fontWeight: 700 }}>
            UAE Dirham
          </div>
          <div style={{ color: "#20C997", fontSize: "1.1rem", fontWeight: 800, marginTop: "2px" }}>
            1 AED = ₹{data.rates.AED.toFixed(2)}
          </div>
        </div>

        {/* SAR to INR */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "0.85rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>🇸🇦</div>
          <div style={{ fontSize: "0.72rem", color: "#8b8aa8", textTransform: "uppercase", fontWeight: 700 }}>
            Saudi Riyal
          </div>
          <div style={{ color: "#f1f0ff", fontSize: "1.1rem", fontWeight: 800, marginTop: "2px" }}>
            1 SAR = ₹{data.rates.SAR.toFixed(2)}
          </div>
        </div>

        {/* QAR to INR */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "0.85rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>🇶🇦</div>
          <div style={{ fontSize: "0.72rem", color: "#8b8aa8", textTransform: "uppercase", fontWeight: 700 }}>
            Qatari Riyal
          </div>
          <div style={{ color: "#f1f0ff", fontSize: "1.1rem", fontWeight: 800, marginTop: "2px" }}>
            1 QAR = ₹{data.rates.QAR.toFixed(2)}
          </div>
        </div>

        {/* OMR to INR */}
        <div
          style={{
            background: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "0.85rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "1.2rem", marginBottom: "0.2rem" }}>🇴🇲</div>
          <div style={{ fontSize: "0.72rem", color: "#8b8aa8", textTransform: "uppercase", fontWeight: 700 }}>
            Omani Rial
          </div>
          <div style={{ color: "#f1f0ff", fontSize: "1.1rem", fontWeight: 800, marginTop: "2px" }}>
            1 OMR = ₹{data.rates.OMR.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Interactive GCC-to-INR Deal Converter */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(250, 204, 21, 0.2)",
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "0.85rem",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#8b8aa8", fontWeight: 600 }}>
            GCC to INR Deal Converter:
          </span>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {/* Currency Selector */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as any)}
              style={{
                padding: "0.35rem 0.6rem",
                background: "#0d1322",
                border: "1px solid rgba(250, 204, 21, 0.3)",
                borderRadius: "6px",
                color: "#facc15",
                fontSize: "0.85rem",
                fontWeight: 700,
                outline: "none",
              }}
            >
              <option value="AED">🇦🇪 AED</option>
              <option value="SAR">🇸🇦 SAR</option>
              <option value="QAR">🇶🇦 QAR</option>
              <option value="OMR">🇴🇲 OMR</option>
            </select>

            {/* Amount input */}
            <input
              type="number"
              value={gccAmount}
              onChange={(e) => setGccAmount(e.target.value)}
              placeholder="1000"
              style={{
                width: "120px",
                padding: "0.35rem 0.65rem",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(250, 204, 21, 0.3)",
                borderRadius: "6px",
                color: "#f1f0ff",
                fontSize: "0.9rem",
                fontWeight: 700,
                textAlign: "right",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Calculated Value in INR */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.75rem 1rem",
            background: "rgba(250, 204, 21, 0.08)",
            borderRadius: "8px",
            border: "1px solid rgba(250, 204, 21, 0.25)",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#facc15", fontWeight: 700 }}>
            {numAmount.toLocaleString()} {selectedCurrency} Equals:
          </div>
          <div style={{ fontSize: "1.35rem", color: "#f1f0ff", fontWeight: 800, letterSpacing: "-0.02em" }}>
            ₹ {convertedINR} <span style={{ fontSize: "0.8rem", color: "#facc15" }}>INR</span>
          </div>
        </div>
      </div>
    </div>
  );
}

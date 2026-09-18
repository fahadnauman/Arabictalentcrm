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
  base: "AED",
  rates: {
    AED: 1.0,
    SAR: 1.0211,
    QAR: 0.9912,
    OMR: 0.1048,
    USD: 0.2723,
  },
  source: "pegged_gcc_parity",
  lastUpdated: new Date().toISOString(),
};

export default function CurrencyWidget() {
  const [data, setData] = useState<CurrencyData>(DEFAULT_RATES);
  const [loading, setLoading] = useState(false);
  const [aedAmount, setAedAmount] = useState<string>("1000");

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

  const numAmount = parseFloat(aedAmount) || 0;
  const convertedSAR = (numAmount * (data.rates.SAR || 1.0211)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const convertedQAR = (numAmount * (data.rates.QAR || 0.9912)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const convertedOMR = (numAmount * (data.rates.OMR || 0.1048)).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

  return (
    <div
      style={{
        background: "linear-gradient(180deg, rgba(20, 24, 39, 0.7) 0%, rgba(10, 14, 26, 0.7) 100%)",
        border: "1px solid rgba(32, 201, 151, 0.2)",
        borderRadius: "16px",
        padding: "1.5rem",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(32, 201, 151, 0.05)",
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
          <span style={{ fontSize: "1.2rem" }}>🪙</span>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "#f1f0ff", fontWeight: 700 }}>
              GCC Currency Exchange Matrix
            </h3>
            <span style={{ fontSize: "0.72rem", color: "#20C997", fontWeight: 600 }}>
              Primary Baseline: 🇦🇪 UAE Dirham (AED)
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

      {/* Baseline & Rates Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        {/* Baseline AED */}
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
            UAE Baseline
          </div>
          <div style={{ color: "#20C997", fontSize: "1.15rem", fontWeight: 800, marginTop: "2px" }}>
            1.00 AED
          </div>
        </div>

        {/* Saudi Riyal (SAR) */}
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
          <div style={{ color: "#f1f0ff", fontSize: "1.15rem", fontWeight: 800, marginTop: "2px" }}>
            {data.rates.SAR.toFixed(4)} <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>SAR</span>
          </div>
        </div>

        {/* Qatari Riyal (QAR) */}
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
          <div style={{ color: "#f1f0ff", fontSize: "1.15rem", fontWeight: 800, marginTop: "2px" }}>
            {data.rates.QAR.toFixed(4)} <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>QAR</span>
          </div>
        </div>

        {/* Omani Rial (OMR) */}
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
          <div style={{ color: "#f1f0ff", fontSize: "1.15rem", fontWeight: 800, marginTop: "2px" }}>
            {data.rates.OMR.toFixed(4)} <span style={{ fontSize: "0.75rem", color: "#8b8aa8" }}>OMR</span>
          </div>
        </div>
      </div>

      {/* Interactive Quick Deal Calculator */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.25)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "12px",
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "0.78rem", color: "#8b8aa8", fontWeight: 600 }}>
            Live Deal Converter (AED Input):
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ color: "#20C997", fontWeight: 700, fontSize: "0.85rem" }}>AED</span>
            <input
              type="number"
              value={aedAmount}
              onChange={(e) => setAedAmount(e.target.value)}
              placeholder="1000"
              style={{
                width: "110px",
                padding: "0.35rem 0.6rem",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(32, 201, 151, 0.3)",
                borderRadius: "6px",
                color: "#f1f0ff",
                fontSize: "0.88rem",
                fontWeight: 700,
                textAlign: "right",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.5rem",
            textAlign: "center",
          }}
        >
          <div style={{ padding: "0.5rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>Saudi Arabia</div>
            <div style={{ color: "#f1f0ff", fontWeight: 700, fontSize: "0.95rem", marginTop: "2px" }}>
              {convertedSAR} <span style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>SAR</span>
            </div>
          </div>

          <div style={{ padding: "0.5rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>Qatar</div>
            <div style={{ color: "#f1f0ff", fontWeight: 700, fontSize: "0.95rem", marginTop: "2px" }}>
              {convertedQAR} <span style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>QAR</span>
            </div>
          </div>

          <div style={{ padding: "0.5rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px" }}>
            <div style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>Oman</div>
            <div style={{ color: "#f1f0ff", fontWeight: 700, fontSize: "0.95rem", marginTop: "2px" }}>
              {convertedOMR} <span style={{ fontSize: "0.7rem", color: "#8b8aa8" }}>OMR</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

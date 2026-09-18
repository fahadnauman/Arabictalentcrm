import { NextResponse } from "next/server";

// Fallback exact GCC pegged exchange rates relative to INR (based on USD/INR ~86.50)
const FALLBACK_RATES_IN_INR = {
  AED: 23.55,  // 86.50 / 3.6725
  SAR: 23.07,  // 86.50 / 3.7500
  QAR: 23.76,  // 86.50 / 3.6400
  OMR: 224.68, // 86.50 / 0.3850
  USD: 86.50,
};

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: controller.signal,
      next: { revalidate: 300 }, // Cache in Next.js for 5 minutes
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`External API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rates = data.rates || {};

    const inrPerUsd = rates.INR || 86.5;
    const aedRate = rates.AED || 3.6725;
    const sarRate = rates.SAR || 3.75;
    const qarRate = rates.QAR || 3.64;
    const omrRate = rates.OMR || 0.385;

    const ratesInINR = {
      AED: Number((inrPerUsd / aedRate).toFixed(2)),
      SAR: Number((inrPerUsd / sarRate).toFixed(2)),
      QAR: Number((inrPerUsd / qarRate).toFixed(2)),
      OMR: Number((inrPerUsd / omrRate).toFixed(2)),
      USD: Number(inrPerUsd.toFixed(2)),
    };

    return NextResponse.json(
      {
        base: "INR",
        rates: ratesInINR,
        source: "live_exchange_api",
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.warn("Using INR currency fallback due to error:", error);
    return NextResponse.json(
      {
        base: "INR",
        rates: FALLBACK_RATES_IN_INR,
        source: "pegged_inr_parity",
        lastUpdated: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  }
}

import { NextResponse } from "next/server";

// Fallback exact GCC pegged exchange rates relative to AED
const FALLBACK_RATES = {
  AED: 1.0,
  SAR: 1.0211, // 3.75 SAR/USD ÷ 3.6725 AED/USD
  QAR: 0.9912, // 3.64 QAR/USD ÷ 3.6725 AED/USD
  OMR: 0.1048, // 0.385 OMR/USD ÷ 3.6725 AED/USD
  USD: 0.2723, // 1 ÷ 3.6725 AED/USD
};

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch("https://open.er-api.com/v6/latest/AED", {
      signal: controller.signal,
      next: { revalidate: 300 }, // Cache in Next.js for 5 minutes
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`External API responded with status ${res.status}`);
    }

    const data = await res.json();
    const rates = data.rates || {};

    return NextResponse.json(
      {
        base: "AED",
        rates: {
          AED: 1.0,
          SAR: rates.SAR ? Number(rates.SAR.toFixed(4)) : FALLBACK_RATES.SAR,
          QAR: rates.QAR ? Number(rates.QAR.toFixed(4)) : FALLBACK_RATES.QAR,
          OMR: rates.OMR ? Number(rates.OMR.toFixed(4)) : FALLBACK_RATES.OMR,
          USD: rates.USD ? Number(rates.USD.toFixed(4)) : FALLBACK_RATES.USD,
        },
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
    console.warn("Using GCC pegged currency fallback due to error:", error);
    return NextResponse.json(
      {
        base: "AED",
        rates: FALLBACK_RATES,
        source: "pegged_gcc_parity",
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

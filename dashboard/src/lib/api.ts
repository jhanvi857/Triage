import {
  TriageCase,
  SummaryStats,
  BatchResult,
  PTPParseResult,
  MLMetrics,
  BenchmarkReport,
  RetrainSummary,
  PortfolioPlan,
  ForecastReport,
} from "./types";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080";

export async function fetchCases(): Promise<TriageCase[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/cases`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.cases || [];
  } catch (err) {
    console.error("fetchCases error:", err);
    return [];
  }
}

export async function createCase(payload: {
  customer_name: string;
  plan_name: string;
  amount_paise: number;
  original_rail: string;
  error_code: string;
  error_desc: string;
  error_reason?: string;
  error_source?: string;
  error_step?: string;
  payday_proximity_days?: number;
  historical_success_rate?: number;
  attempts_made?: number;
}): Promise<TriageCase | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("createCase error:", err);
    return null;
  }
}

export async function advanceCase(caseId: string): Promise<TriageCase | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/cases/${caseId}/advance`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`advanceCase (${caseId}) error:`, err);
    return null;
  }
}

export async function resolveCase(
  caseId: string,
  resolution: "RECOVERED" | "LOST" | "ESCALATED",
  notes: string
): Promise<TriageCase | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/cases/${caseId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution, notes }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`resolveCase (${caseId}) error:`, err);
    return null;
  }
}

export async function parsePTP(message: string, caseId?: string): Promise<PTPParseResult | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/ptp/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, case_id: caseId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("parsePTP error:", err);
    return null;
  }
}

export async function fetchMLMetrics(): Promise<MLMetrics | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/ml/metrics`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchMLMetrics error:", err);
    return null;
  }
}

export async function fetchBenchmarkReport(): Promise<BenchmarkReport | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/ml/benchmark`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchBenchmarkReport error:", err);
    return null;
  }
}

export async function triggerRetraining(outcomes: any[] = []): Promise<RetrainSummary | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/ml/retrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcomes }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("triggerRetraining error:", err);
    return null;
  }
}

export async function fetchRetrainHistory(): Promise<RetrainSummary[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/ml/retrain/history`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("fetchRetrainHistory error:", err);
    return [];
  }
}

export async function fetchPortfolioPlan(
  discountBudgetLimitPaise: number = 500000,
  humanDeskCapacity: number = 5
): Promise<PortfolioPlan | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/portfolio/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discount_budget_limit_paise: discountBudgetLimitPaise,
        human_desk_capacity: humanDeskCapacity,
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchPortfolioPlan error:", err);
    return null;
  }
}

export async function fetchRevenueForecast(): Promise<ForecastReport | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/forecast`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchRevenueForecast error:", err);
    return null;
  }
}

export async function runBatchEvaluation(count: number = 15): Promise<BatchResult | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/batch/run?count=${count}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("runBatchEvaluation error:", err);
    return null;
  }
}

export async function fetchSummaryStats(): Promise<SummaryStats | null> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/stats`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("fetchSummaryStats error:", err);
    return null;
  }
}

export async function resetTriageBoard(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/triage/reset`, {
      method: "POST",
    });
    return res.ok;
  } catch (err) {
    console.error("resetTriageBoard error:", err);
    return false;
  }
}

export function getTriageSSEUrl(): string {
  return `${GATEWAY_URL}/api/v1/triage/stream`;
}

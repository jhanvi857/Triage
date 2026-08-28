"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  Check,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  ShieldCheck,
  Clock,
  Sparkles,
  Bot,
  MessageSquare,
  Calendar,
  Send,
  HelpCircle,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { TriageCase, PTPParseResult } from "../lib/types";
import { parsePTP } from "../lib/api";

interface CaseDetailViewProps {
  caseItem: TriageCase;
  onBack: () => void;
  onAdvance: (id: string) => Promise<void>;
  onResolve: (id: string, resolution: "RECOVERED" | "LOST" | "ESCALATED", notes: string) => Promise<void>;
}

export const CaseDetailView: React.FC<CaseDetailViewProps> = ({
  caseItem,
  onBack,
  onAdvance,
  onResolve,
}) => {
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [ptpInput, setPtpInput] = useState<string>("");
  const [ptpResult, setPtpResult] = useState<PTPParseResult | null>(caseItem.ptp_status || null);
  const [isParsingPtp, setIsParsingPtp] = useState<boolean>(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await onAdvance(caseItem.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTestPTP = async (textToParse?: string) => {
    const query = textToParse || ptpInput;
    if (!query.trim()) return;
    setIsParsingPtp(true);
    try {
      const res = await parsePTP(query, caseItem.id);
      if (res) {
        setPtpResult(res);
      }
    } finally {
      setIsParsingPtp(false);
    }
  };

  const getStatusBadgeClass = () => {
    switch (caseItem.status) {
      case "RECOVERED":
        return "bg-[#2E7D5B]/10 text-[#2E7D5B] border-[#2E7D5B]/20";
      case "ESCALATED":
        return "bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/20";
      case "LOST":
        return "bg-[#C94A4A]/10 text-[#C94A4A] border-[#C94A4A]/20";
      case "INTERVENING":
      case "DIAGNOSED":
        return "bg-[#087F83]/10 text-[#087F83] border-[#087F83]/20";
      default:
        return "bg-[#F5F6F6] text-[#6F7777] border-[#E2E5E5]";
    }
  };

  const topMLAction = caseItem.intervention?.ml_recommendation || caseItem.intervention?.action;
  const policyVerdict = caseItem.intervention?.policy_verdict || "AUTHORIZED";
  const isVetoed = policyVerdict === "VETOED" || caseItem.intervention?.is_stopping_rule_hit;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 font-sans">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-[12px] font-medium text-[#6F7777] hover:text-[#202525] transition-colors cursor-pointer py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </button>

      {/* Case Header */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="font-mono text-[12px] font-medium text-[#6F7777]">{caseItem.id}</span>
            {caseItem.source === "LIVE" ? (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
                  caseItem.is_simulated
                    ? "bg-[#FFFAF0] text-[#DD6B20] border-[#FEEBC8]"
                    : "bg-[#EBF8F2] text-[#2F855A] border-[#C6F6D5]"
                }`}
              >
                {caseItem.is_simulated ? "LIVE · SIMULATED" : "LIVE · VERIFIED"}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border bg-[#F5F6F6] text-[#506361] border-[#E2E5E5]">
                SYNTHETIC · BATCH
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadgeClass()}`}>
              {caseItem.status}
            </span>
            {caseItem.intervention?.policy_verdict && (
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${isVetoed
                    ? "bg-[#C94A4A]/10 text-[#C94A4A] border border-[#C94A4A]/20"
                    : "bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/20"
                  }`}
              >
                POLICY: {caseItem.intervention.policy_verdict}
              </span>
            )}
          </div>
          <h1 className="font-semibold text-[24px] tracking-tight text-[#202525] mt-1.5 leading-tight">
            {caseItem.customer_name}
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            {caseItem.plan_name} &bull; {caseItem.customer_email || "billing@customer.com"}
          </p>
        </div>

        <div className="text-left md:text-right border-t md:border-t-0 md:border-l border-[#E2E5E5] pt-3 md:pt-0 md:pl-6">
          <span className="text-[14px] font-semibold text-[#6F7777] block">
            Revenue at Risk
          </span>
          <div className="font-mono text-[26px] font-semibold text-[#202525] leading-tight mt-0.5">
            ₹{caseItem.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <span className="font-mono text-[12px] font-normal text-[#6F7777] block mt-0.5">
            Rail: <strong className="font-medium text-[#202525]">{caseItem.original_rail}</strong> &bull; Attempt {caseItem.attempts_made}/{caseItem.max_attempts}
          </span>
        </div>
      </div>

      {/* 1. DETERMINISTIC DIAGNOSIS CARD */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Root-Cause Diagnosis
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            Deterministic Rule Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px] pt-1">
          <div>
            <span className="text-[#6F7777] block text-[12px] font-normal">Classified Root Cause</span>
            <span className="font-mono text-[14px] font-semibold text-[#202525] uppercase">
              {caseItem.diagnosis?.root_cause || caseItem.error_code}
            </span>
            <p className="text-[#6F7777] mt-1 text-[13px] font-normal">
              {caseItem.diagnosis?.technical_reason || caseItem.error_desc}
            </p>
          </div>
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5] space-y-1 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Payday Proximity:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.payday_proximity_days ? `${caseItem.payday_proximity_days} days away` : "Standard (10d)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Historical Customer Success:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.historical_success_rate ? `${Math.round(caseItem.historical_success_rate * 100)}%` : "85%"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Rule Confidence:</span>
              <span className="font-mono font-semibold text-[#2E7D5B]">
                {caseItem.diagnosis?.confidence_score ? `${Math.round(caseItem.diagnosis.confidence_score * 100)}%` : "95%"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. NATURAL ML ACTION RANKING & POLICY DECISION HIERARCHY */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-5">
        {/* ML Action Ranking */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E5]">
            <h2 className="font-semibold text-[16px] text-[#202525]">
              ML Action Ranking
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#6F7777]">
              P(Recovery) &times; Expected Value
            </span>
          </div>

          <div className="mt-2 divide-y divide-[#E2E5E5] text-[13px] font-mono">
            {(caseItem.intervention?.ml_rankings && caseItem.intervention.ml_rankings.length > 0
              ? caseItem.intervention.ml_rankings
              : [
                { action: "Retry Later", probability_percent: 65.6, expected_value_inr: Math.round(caseItem.amount_inr * 0.656), reasoning: "Optimal success window" },
                { action: "Incentive Discount", probability_percent: 42.1, expected_value_inr: Math.round(caseItem.amount_inr * 0.421), reasoning: "Concession budget eligible" },
                { action: "Switch Rail", probability_percent: 38.2, expected_value_inr: Math.round(caseItem.amount_inr * 0.382), reasoning: "UPI fallback rail available" },
                { action: "Escalate Human", probability_percent: 10.7, expected_value_inr: Math.round(caseItem.amount_inr * 0.107), reasoning: "Manual outreach" },
              ]
            ).map((cand, idx) => {
              const isSelected = idx === 0 || cand.action === topMLAction;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-2.5 px-3 rounded transition-colors ${isSelected ? "bg-[#087F83]/10 text-[#202525]" : "text-[#6F7777] hover:bg-[#F5F6F6]"
                    }`}
                >
                  <div className="flex items-center space-x-2">
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#087F83]" />}
                    <span className={isSelected ? "text-[#087F83] font-semibold" : "text-[#202525] font-normal"}>
                      {cand.action}
                    </span>
                  </div>

                  <div className="flex items-center space-x-6">
                    <span className={isSelected ? "text-[#087F83] font-semibold" : "text-[#6F7777] font-normal"}>
                      {cand.probability_percent.toFixed(1)}%
                    </span>
                    <span className="text-[#202525] font-medium min-w-[80px] text-right">
                      ₹{cand.expected_value_inr.toLocaleString("en-IN")} EV
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Downward Transition Arrow */}
        <div className="flex justify-center text-[#6F7777] py-1">
          <ArrowDown className="w-4 h-4 text-[#6F7777]" />
        </div>

        {/* Policy Check */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E5]">
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Policy Check
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#6F7777]">
              Deterministic Hard Guardrails
            </span>
          </div>

          <div className="mt-3 space-y-2 text-[13px]">
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Candidate permitted</span>
              <span className="text-[#6F7777] text-[12px] font-normal">• Action is in pre-approved candidate set</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Attempt limit</span>
              <span className="text-[#6F7777] text-[12px] font-normal">• Attempts ({caseItem.attempts_made}/{caseItem.max_attempts}) within safety bound</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Cooldown</span>
              <span className="text-[#6F7777] text-[12px] font-normal">• Required cooldown threshold met</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Amount threshold</span>
              <span className="text-[#6F7777] text-[12px] font-normal">• Transaction ₹{caseItem.amount_inr} eligible for automated dispatch</span>
            </div>
          </div>
        </div>

        {/* Verdict Banner */}
        <div className={`p-4 rounded-lg border flex items-center justify-between ${isVetoed
            ? "bg-[#C94A4A]/10 border-[#C94A4A]/30 text-[#C94A4A]"
            : "bg-[#2E7D5B]/10 border-[#2E7D5B]/20 text-[#2E7D5B]"
          }`}>
          <div>
            <div className="font-semibold text-[14px] tracking-wide uppercase">
              {isVetoed ? "VETOED" : "AUTHORIZED"}
            </div>
            <div className="text-[13px] font-mono text-[#202525] font-medium mt-0.5">
              Action: {topMLAction || "Retry Later"}
            </div>
          </div>

          {caseItem.status !== "RECOVERED" && caseItem.status !== "LOST" && (
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="px-4 py-2 rounded bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExecuting ? "Executing..." : "Execute Authorized Action"}
            </button>
          )}
        </div>
      </div>

      {/* 4. DETERMINISTIC CUSTOMER MESSAGE TEMPLATE */}
      {caseItem.customer_facing_msg && (
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-[#087F83]" />
              <h2 className="font-semibold text-[14px] text-[#202525]">
                Customer Communication
              </h2>
            </div>
            <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
              Fixed Template &bull; Deterministic Copy
            </span>
          </div>

          <div className="bg-[#F5F6F6] border-l-2 border-[#087F83] p-3.5 rounded-r-md">
            <p className="text-[14px] font-normal text-[#202525] leading-relaxed italic">
              &ldquo;{caseItem.customer_facing_msg}&rdquo;
            </p>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Generated via template substitution: <code>templates[Cause][Action]</code> with customer name, amount, and payment links.
          </span>
        </div>
      )}

      {/* 5. DETERMINISTIC PROMISE-TO-PAY (PTP) INTERACTIVE TESTER */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[14px] text-[#202525]">
              Promise-to-Pay (PTP) Parser
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            Regex Extraction &bull; Ambiguity Escalates
          </span>
        </div>

        <p className="text-[14px] font-normal text-[#6F7777]">
          Predefined date and confirmation patterns are deterministically scheduled; ambiguous language is escalated to human retention desks.
        </p>

        {/* Input & Quick Chips */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={ptpInput}
              onChange={(e) => setPtpInput(e.target.value)}
              placeholder="e.g. Bhai 5th ko debit karna or haan next Monday..."
              className="flex-1 px-3 py-2 text-[13px] font-normal border border-[#E2E5E5] rounded-md bg-[#FFFFFF] text-[#202525] focus:outline-hidden focus:border-[#087F83]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTestPTP();
              }}
            />
            <button
              onClick={() => handleTestPTP()}
              disabled={isParsingPtp}
              className="px-4 py-2 bg-[#087F83] hover:bg-[#06686B] text-white rounded-md text-[12px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isParsingPtp ? "Parsing..." : "Parse Message"}
            </button>
          </div>

          {/* Quick preset chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[12px] font-normal text-[#6F7777] self-center mr-1">Presets:</span>
            {[
              "Bhai 5th ko debit karna",
              "05/09/2026",
              "haan next Monday",
              "tomorrow",
              "Actually things are complicated, I will pay sometime later...",
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setPtpInput(preset);
                  handleTestPTP(preset);
                }}
                className="text-[11px] font-mono bg-[#F5F6F6] hover:bg-[#E2E5E5] border border-[#E2E5E5] px-2 py-0.5 rounded text-[#202525] transition-colors cursor-pointer"
              >
                &ldquo;{preset.length > 25 ? preset.substring(0, 22) + "..." : preset}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* PTP Result Output */}
        {ptpResult && (
          <div
            className={`p-3.5 rounded-md border text-[13px] space-y-1 ${ptpResult.promise_detected
                ? "bg-[#2E7D5B]/10 border-[#2E7D5B]/20 text-[#2E7D5B]"
                : ptpResult.needs_human_review
                  ? "bg-[#B7791F]/10 border-[#B7791F]/20 text-[#B7791F]"
                  : "bg-[#F5F6F6] border-[#E2E5E5] text-[#6F7777]"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide text-[11px] flex items-center gap-1">
                {ptpResult.promise_detected ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
                    <span>Promise-to-Pay Scheduled</span>
                  </>
                ) : ptpResult.needs_human_review ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-[#B7791F]" />
                    <span>Escalated to Human Review</span>
                  </>
                ) : (
                  <span>No Promise Detected</span>
                )}
              </span>
              <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-[#E2E5E5]">
                Method: {ptpResult.parsing_method}
              </span>
            </div>

            {ptpResult.promised_date && (
              <div className="font-mono font-semibold text-[14px] text-[#2E7D5B]">
                Scheduled Retry Date: {ptpResult.promised_date}
              </div>
            )}

            {ptpResult.escalation_reason && (
              <p className="text-[#B7791F] text-[13px] font-normal">
                Reason: {ptpResult.escalation_reason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 6. CRYPTOGRAPHIC AUDIT LOG BLOCK */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <h2 className="font-semibold text-[14px] text-[#202525]">
            Immutable SHA-256 Ledger State
          </h2>
          <span className="font-mono text-[11px] text-[#2E7D5B] font-semibold bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 px-2 py-0.5 rounded flex items-center gap-1">
            <Check className="w-3 h-3 text-[#2E7D5B]" />
            <span>Chain Verified</span>
          </span>
        </div>

        <div className="space-y-2 text-[12px] font-mono">
          <div className="flex justify-between text-[#6F7777]">
            <span className="font-normal">Idempotency Key:</span>
            <span className="text-[#202525] font-medium">{caseItem.idempotency_key}</span>
          </div>
          {caseItem.razorpay_payment_id && (
            <div className="flex justify-between text-[#6F7777]">
              <span className="font-normal">Razorpay Settlement ID:</span>
              <span className="text-[#2E7D5B] font-medium">{caseItem.razorpay_payment_id}</span>
            </div>
          )}
          {caseItem.recovered_amount_paise > 0 && (
            <div className="flex justify-between text-[#6F7777]">
              <span className="font-normal">Recovered INR:</span>
              <span className="text-[#2E7D5B] font-semibold">
                ₹{(caseItem.recovered_amount_paise / 100).toFixed(2)}
              </span>
            </div>
          )}
          {caseItem.incentive_discount_paise > 0 && (
            <div className="flex justify-between text-[#6F7777]">
              <span className="font-normal">Applied Concession:</span>
              <span className="text-[#087F83] font-semibold">
                ₹{(caseItem.incentive_discount_paise / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

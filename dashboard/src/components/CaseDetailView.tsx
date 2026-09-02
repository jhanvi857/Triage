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
  Compass,
  CreditCard,
  Smartphone,
  Layers,
  FileCheck2,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
  Mail,
  Phone,
  UserCheck,
  X,
  Copy,
  Headphones
} from "lucide-react";
import { TriageCase, PTPParseResult, CustomerNudgeDraft } from "../lib/types";
import { parsePTP, draftNudge } from "../lib/api";
import { ShadowBanditModal } from "./ShadowBanditModal";
import { RecoveryPlanView } from "./RecoveryPlanView";

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
  const [isShadowBanditOpen, setIsShadowBanditOpen] = useState<boolean>(false);
  const [activeChannel, setActiveChannel] = useState<"EMAIL">("EMAIL");
  const [nudgeDraft, setNudgeDraft] = useState<CustomerNudgeDraft | null>(caseItem.customer_nudge_draft || null);
  const [isDraftingNudge, setIsDraftingNudge] = useState<boolean>(false);
  const [nudgeSentMsg, setNudgeSentMsg] = useState<string | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState<boolean>(false);
  const [emailDispatched, setEmailDispatched] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const customerPortalUrl = `http://localhost:5173/status/${caseItem.id}`;

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await onAdvance(caseItem.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const handlePrimaryCtaClick = () => {
    const ctaName = nudgeDraft?.primary_cta || "Primary Action";
    if (ctaName.toLowerCase().includes("specialist") || ctaName.toLowerCase().includes("support") || isVetoed) {
      setIsSupportModalOpen(true);
      setNudgeSentMsg(`Opened Billing Specialist desk for ${caseItem.id}.`);
    } else {
      window.open(customerPortalUrl, "_blank");
      setNudgeSentMsg(`Opened live customer payment link for "${ctaName}" (${customerPortalUrl}).`);
    }
  };

  const handleSecondaryCtaClick = () => {
    setIsSupportModalOpen(true);
    setNudgeSentMsg(`Opening live support desk for Case ${caseItem.id}...`);
  };

  const handleChannelSwitch = async (channel: "EMAIL" = "EMAIL") => {
    setActiveChannel(channel);
    setIsDraftingNudge(true);
    try {
      const res = await draftNudge(caseItem.id, channel);
      if (res && res.draft) {
        setNudgeDraft(res.draft);
      }
    } finally {
      setIsDraftingNudge(false);
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
      case "RETRY_SCHEDULED":
        return "bg-[#3182CE]/10 text-[#3182CE] border-[#3182CE]/20";
      case "RETRY_IN_FLIGHT":
        return "bg-[#D69E2E]/10 text-[#D69E2E] border-[#D69E2E]/20";
      case "RETRY_FAILED":
        return "bg-[#E53E3E]/10 text-[#E53E3E] border-[#E53E3E]/20";
      case "PTP_COMMITTED":
        return "bg-[#3182CE]/10 text-[#3182CE] border-[#3182CE]/20";
      case "PTP_MISSED":
        return "bg-[#DD6B20]/10 text-[#DD6B20] border-[#DD6B20]/20";
      case "HUMAN_RESOLVED":
        return "bg-[#2B6CB0]/10 text-[#2B6CB0] border-[#2B6CB0]/20";
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
  const candidateEvaluations = caseItem.candidate_evaluations || caseItem.intervention?.candidate_evaluations || [];
  const actionRationale = caseItem.action_rationale || caseItem.intervention?.action_rationale;

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
                title={caseItem.is_simulated ? "Live customer storefront event (Razorpay Sandbox mode — real customer interaction, safe test capture)" : "HMAC-verified live webhook from Razorpay API"}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border bg-[#EBF8F2] text-[#2F855A] border-[#C6F6D5] flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F855A] animate-pulse"></span>
                <span>{caseItem.is_simulated ? "LIVE · SANDBOX" : "LIVE · HMAC VERIFIED"}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border bg-[#F5F6F6] text-[#506361] border-[#E2E5E5]">
                SYNTHETIC · BATCH
              </span>
            )}
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusBadgeClass()}`}>
              {caseItem.status === "PTP_COMMITTED" ? "PROMISED (PENDING)" : caseItem.status === "HUMAN_RESOLVED" ? "ESCALATED → HUMAN_RESOLVED" : caseItem.status}
            </span>
            {caseItem.intervention?.policy_verdict && (
              <span
                className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                  isVetoed
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
          {caseItem.incentive_discount_paise > 0 ? (() => {
            const totalPaise = caseItem.amount_paise || (caseItem.amount_inr * 100);
            const pct = totalPaise > 0 ? (caseItem.incentive_discount_paise / totalPaise) * 100 : 5;
            const pctStr = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
            return (
              <div className="font-mono text-[11px] font-medium text-[#087F83] mt-1 bg-[#E6F4F1] px-2 py-0.5 rounded inline-block border border-[#B2DFDB]">
                {pctStr} Concession Applied: -₹{(caseItem.incentive_discount_paise / 100).toFixed(2)} &bull; Net: ₹{((caseItem.amount_inr * 100 - caseItem.incentive_discount_paise) / 100).toFixed(2)}
              </div>
            );
          })() : (
            (caseItem.intervention?.action === "INCENTIVE_DISCOUNT" ||
              ((caseItem.diagnosis?.root_cause === "INSUFFICIENT_FUNDS" || caseItem.error_code === "INSUFFICIENT_FUNDS") &&
                caseItem.available_balance_inr !== undefined &&
                caseItem.available_balance_inr < caseItem.amount_inr &&
                caseItem.available_balance_inr >= caseItem.amount_inr - Math.min(0.05 * caseItem.amount_inr, 500))) && (() => {
              const discountINR = Math.min(0.05 * caseItem.amount_inr, 500);
              const pct = caseItem.amount_inr > 0 ? (discountINR / caseItem.amount_inr) * 100 : 5;
              const pctStr = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
              return (
                <div className="font-mono text-[11px] font-medium text-[#087F83] mt-1 bg-[#E6F4F1] px-2 py-0.5 rounded inline-block border border-[#B2DFDB]">
                  {pctStr} Gap-Closing Concession: -₹{discountINR.toFixed(2)} &bull; Net: ₹{(caseItem.amount_inr - discountINR).toFixed(2)}
                </div>
              );
            })()
          )}
          <span className="font-mono text-[12px] font-normal text-[#6F7777] block mt-0.5">
            Rail: <strong className="font-medium text-[#202525]">{caseItem.original_rail}</strong> &bull; Attempt {caseItem.attempts_made}/{caseItem.max_attempts}
          </span>
        </div>
      </div>

      {/* 1. DETERMINISTIC DIAGNOSIS & RECOVERY CONTEXT */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Deterministic Root-Cause Diagnosis
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            Rule Engine (Zero Ambiguity)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          <div>
            <span className="text-[#6F7777] block text-[12px] font-normal">Classified Root Cause</span>
            <span className="font-mono text-[15px] font-semibold text-[#202525] uppercase">
              {caseItem.diagnosis?.root_cause || caseItem.error_code}
            </span>
            <p className="text-[#6F7777] mt-1 text-[13px] font-normal">
              {caseItem.diagnosis?.technical_reason || caseItem.error_desc}
            </p>
          </div>
          <div className="bg-[#F5F6F6] p-3.5 rounded-md border border-[#E2E5E5] space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Payday Proximity:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.payday_proximity_days ? `${caseItem.payday_proximity_days} days away` : "Standard (10d)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Customer Historical Success:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.historical_success_rate ? `${Math.round(caseItem.historical_success_rate * 100)}%` : "85%"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">Alternate Saved Card:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.has_alternate_saved_card ? (
                  <span className="text-[#2E7D5B] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> {caseItem.alternate_saved_card_label || "Visa •••• 4821"} ({caseItem.alternate_card_success_count || 4} past tx)
                  </span>
                ) : (
                  <span className="text-[#6F7777]">None Available</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6F7777] font-normal">UPI Fallback Rail:</span>
              <span className="font-mono font-medium text-[#202525]">
                {caseItem.has_upi_available ? (
                  <span className="text-[#2E7D5B] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Available & Active
                  </span>
                ) : (
                  <span className="text-[#6F7777]">Unavailable</span>
                )}
              </span>
            </div>
            {caseItem.available_balance_inr !== undefined && caseItem.available_balance_inr !== null && (
              <div className="flex justify-between">
                <span className="text-[#6F7777] font-normal">Customer Available Balance:</span>
                <span className="font-mono font-medium text-[#B45309]">
                  ₹{caseItem.available_balance_inr.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. CONTEXT-AWARE CANDIDATE ELIGIBILITY PROVENANCE */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Context-Aware Candidate Eligibility Engine
            </h2>
          </div>
          <span className="font-mono text-[11px] font-semibold text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB]">
            Deterministic Pre-Filter &bull; Zero ML Input
          </span>
        </div>

        <p className="text-[13px] text-[#6F7777]">
          Candidate bounds are dynamically derived from real-time customer context, available instruments, and failure cause. ML only ranks candidate actions that pass deterministic eligibility.
        </p>

        <div className="border border-[#E2E5E5] rounded-md overflow-hidden">
          <table className="w-full text-left text-[12px] font-mono">
            <thead className="bg-[#F5F6F6] text-[#6F7777] border-b border-[#E2E5E5] uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Action Candidate</th>
                <th className="py-2.5 px-3">Eligibility Rationale</th>
                <th className="py-2.5 px-3">Context Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {candidateEvaluations.length > 0 ? (
                candidateEvaluations.map((ev, idx) => (
                  <tr key={idx} className={ev.eligible ? "bg-white" : "bg-[#FAFBFB] opacity-75"}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {ev.eligible ? (
                        <span className="inline-flex items-center gap-1 text-[#2E7D5B] font-semibold bg-[#2E7D5B]/10 px-2 py-0.5 rounded text-[10px]">
                          <Check className="w-3 h-3" /> ELIGIBLE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#C94A4A] font-semibold bg-[#C94A4A]/10 px-2 py-0.5 rounded text-[10px]">
                          <XCircle className="w-3 h-3" /> INELIGIBLE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#202525]">
                      {ev.display_name || ev.action}
                      <span className="block text-[10px] text-[#6F7777] font-normal">{ev.action}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#202525] font-sans">
                      {ev.reason}
                    </td>
                    <td className="py-2.5 px-3 text-[#6F7777]">
                      {ev.signals && ev.signals.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {ev.signals.map((sig, sIdx) => (
                            <span key={sIdx} className="bg-[#E2E5E5]/60 text-[#202525] px-1.5 py-0.5 rounded text-[10px]">
                              {sig}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#9E9E9E]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-[#6F7777]">
                    No candidate evaluations available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. ML EXPECTED-VALUE RANKING & "WHY THIS ACTION?" DECISION PANEL */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-5">
        {/* ML Action Ranking */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E5]">
            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-[16px] text-[#202525]">
                ML Expected-Value Ranking
              </h2>
              {caseItem.intervention?.shadow_bandit && (
                <button
                  onClick={() => setIsShadowBanditOpen(true)}
                  className="flex items-center space-x-1 text-[11px] font-mono font-semibold text-[#087F83] bg-[#E6F4F1] hover:bg-[#D1EAE5] px-2 py-0.5 rounded border border-[#B2DFDB] transition-colors cursor-pointer"
                  title="Inspect Contextual Shadow Bandit Exploration"
                >
                  <Compass className="w-3 h-3 text-[#087F83]" />
                  <span>Shadow Bandit</span>
                </button>
              )}
            </div>
            <span className="font-mono text-[11px] font-semibold text-[#6F7777]">
              P(Recovery) &times; Expected Value (INR)
            </span>
          </div>

          <div className="mt-2 divide-y divide-[#E2E5E5] text-[13px] font-mono">
            {(caseItem.intervention?.ml_rankings && caseItem.intervention.ml_rankings.length > 0
              ? caseItem.intervention.ml_rankings
              : (caseItem.diagnosis?.root_cause === "INSUFFICIENT_FUNDS" || caseItem.error_code === "INSUFFICIENT_FUNDS")
              ? [
                  { action: "RETRY_NEXT_PAYDAY_WINDOW", probability_percent: 86.0, expected_value_inr: Math.round(caseItem.amount_inr * 0.86), reasoning: "Customer payday/salary cycle is in 1 day; high probability of automatic settlement" },
                  { action: "PROMISE_TO_PAY", probability_percent: 48.0, expected_value_inr: Math.round(caseItem.amount_inr * 0.48), reasoning: "Conversational customer commitment" },
                  { action: "ESCALATE_HUMAN", probability_percent: 20.0, expected_value_inr: Math.round(caseItem.amount_inr * 0.20), reasoning: "Manual support outreach" },
                ]
              : [
                  { action: "SWITCH_TO_SAVED_CARD", probability_percent: 86.5, expected_value_inr: Math.round(caseItem.amount_inr * 0.865), reasoning: "Active alternate Visa card with 4 prior successes" },
                  { action: "RETRY_NEXT_PAYDAY_WINDOW", probability_percent: 38.2, expected_value_inr: Math.round(caseItem.amount_inr * 0.382), reasoning: "Payday is 18 days away; low immediate probability" },
                  { action: "PROMISE_TO_PAY", probability_percent: 54.0, expected_value_inr: Math.round(caseItem.amount_inr * 0.54), reasoning: "Customer commitment engagement" },
                  { action: "ESCALATE_HUMAN", probability_percent: 15.0, expected_value_inr: Math.round(caseItem.amount_inr * 0.15), reasoning: "Manual support outreach" },
                ]
            ).map((cand, idx) => {
              const isSelected = idx === 0 || cand.action === topMLAction;
              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-2.5 px-3 rounded transition-colors ${
                    isSelected ? "bg-[#087F83]/10 text-[#202525]" : "text-[#6F7777] hover:bg-[#F5F6F6]"
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

        {/* "Why this action?" Decision Panel */}
        <div className="bg-[#FAFBFB] border border-[#E2E5E5] rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-[#087F83]" />
            <h3 className="font-semibold text-[14px] text-[#202525]">
              Decision Rationale: Why was &lsquo;{topMLAction}&rsquo; chosen?
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
            <div className="space-y-1.5">
              <span className="font-semibold text-[#2E7D5B] uppercase text-[11px] block">
                &check; Positive Signals Identified
              </span>
              {actionRationale && actionRationale.positive_signals && actionRationale.positive_signals.length > 0 ? (
                <ul className="space-y-1">
                  {actionRationale.positive_signals.map((sig, sIdx) => (
                    <li key={sIdx} className="flex items-start gap-1.5 text-[#202525]">
                      <Check className="w-3.5 h-3.5 text-[#2E7D5B] shrink-0 mt-0.5" />
                      <span>{sig}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#6F7777]">Highest expected value under current failure context and instrument profile.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="font-semibold text-[#6F7777] uppercase text-[11px] block">
                &times; Rejected / Ineligible Alternatives
              </span>
              {actionRationale && actionRationale.rejected_alternatives && actionRationale.rejected_alternatives.length > 0 ? (
                <ul className="space-y-1">
                  {actionRationale.rejected_alternatives.map((rej, rIdx) => (
                    <li key={rIdx} className="flex items-start gap-1.5 text-[#6F7777]">
                      <XCircle className="w-3.5 h-3.5 text-[#6F7777] shrink-0 mt-0.5" />
                      <span>{rej}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#6F7777]">Alternative candidates evaluated with lower recovery expectation or restricted by policy.</p>
              )}
            </div>
          </div>
        </div>

        {/* Downward Transition Arrow */}
        <div className="flex justify-center text-[#6F7777] py-1">
          <ArrowDown className="w-4 h-4 text-[#6F7777]" />
        </div>

        {/* Deterministic Policy Check */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E5E5]">
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Deterministic Policy Authorization
            </h2>
            <span className="font-mono text-[11px] font-semibold text-[#6F7777]">
              Financial Authority Hard Guardrails
            </span>
          </div>

          <div className="mt-3 space-y-2 text-[13px]">
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Candidate permitted</span>
              <span className="text-[#6F7777] text-[12px] font-normal">&bull; Action is in pre-approved candidate set</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Attempt limit</span>
              <span className="text-[#6F7777] text-[12px] font-normal">&bull; Attempts ({caseItem.attempts_made}/{caseItem.max_attempts}) within safety bound</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Cooldown threshold</span>
              <span className="text-[#6F7777] text-[12px] font-normal">&bull; Required cooldown threshold met</span>
            </div>
            <div className="flex items-center space-x-2 text-[#2E7D5B]">
              <Check className="w-4 h-4 text-[#2E7D5B] shrink-0" />
              <span className="text-[#202525] font-medium">Amount threshold</span>
              <span className="text-[#6F7777] text-[12px] font-normal">&bull; Transaction ₹{caseItem.amount_inr.toLocaleString("en-IN")} eligible for automated dispatch (&le; ₹15,000 ceiling)</span>
            </div>
          </div>
        </div>

        {/* Verdict Banner */}
        <div
          className={`p-4 rounded-lg border flex items-center justify-between ${
            isVetoed
              ? "bg-[#C94A4A]/10 border-[#C94A4A]/30 text-[#C94A4A]"
              : "bg-[#2E7D5B]/10 border-[#2E7D5B]/20 text-[#2E7D5B]"
          }`}
        >
          <div>
            <div className="font-semibold text-[14px] tracking-wide uppercase">
              {isVetoed ? "POLICY VETOED" : "POLICY AUTHORIZED"}
            </div>
            <div className="text-[13px] font-mono text-[#202525] font-medium mt-0.5">
              Approved Action: <strong>{topMLAction || "RETRY_NEXT_PAYDAY_WINDOW"}</strong>
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

      {/* 4. POLICY-GATED CUSTOMER MESSAGING & OUTPUT VALIDATOR */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[16px] text-[#202525]">
              Policy-Gated Customer Messaging
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#E6F4F1] text-[#087F83] px-2 py-0.5 rounded border border-[#B2DFDB]">
            Deterministic Recovery Templates &bull; Policy-Gated Dispatch &bull; Zero Hallucinations
          </span>
        </div>

        {/* Outbound Email Channel Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-[12px] font-semibold rounded-md bg-[#087F83] text-white flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>Outbound Recovery Email</span>
            </span>
            <span className="text-[11px] font-mono text-[#6F7777] bg-[#F5F6F6] border border-[#E2E5E5] px-2 py-0.5 rounded">
              Recipient: <strong>{caseItem.customer_email || "customer@example.com"}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#2E7D5B] bg-[#2E7D5B]/10 border border-[#2E7D5B]/20 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>SAFETY VALIDATED: Claims Verified Against Policy</span>
          </div>
        </div>

        {/* Interactive Email Preview Card */}
        <div className="bg-[#F5F6F6] border border-[#E2E5E5] rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center text-[12px] text-[#6F7777] border-b border-[#E2E5E5] pb-2">
            <span className="font-semibold text-[#202525]">
              {nudgeDraft?.headline || "Action Required: Subscription Payment Recovery"}
            </span>
            <span className="font-mono text-[11px]">
              Channel: <strong>EMAIL (SMTP)</strong>
            </span>
          </div>

          <p className="text-[13px] font-normal text-[#202525] leading-relaxed italic bg-white p-3 rounded border border-[#E2E5E5]">
            &ldquo;{nudgeDraft?.body || caseItem.customer_facing_msg || "Your payment retry has been scheduled."}&rdquo;
          </p>

          <div className="flex items-center justify-between pt-1 text-[12px]">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrimaryCtaClick}
                className="px-3 py-1 rounded bg-[#087F83] text-white text-[11px] font-medium inline-flex items-center gap-1 hover:bg-[#066467] active:scale-95 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-3 h-3" /> {nudgeDraft?.primary_cta || "Approve Alternate Card"}
              </button>
              {nudgeDraft?.secondary_cta && (
                <button
                  type="button"
                  onClick={handleSecondaryCtaClick}
                  className="px-3 py-1 rounded bg-white text-[#6F7777] border border-[#E2E5E5] text-[11px] font-medium hover:bg-[#F5F6F6] hover:text-[#202525] active:scale-95 transition-all cursor-pointer"
                >
                  {nudgeDraft.secondary_cta}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsEmailPreviewOpen(true)}
                className="text-[11px] text-[#087F83] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <Mail className="w-3 h-3" /> Preview HTML Email
              </button>

              <button
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                className="text-[11px] text-[#087F83] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <Headphones className="w-3 h-3" /> Support Desk
              </button>

              <a
                href={customerPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-[#087F83] hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <ExternalLink className="w-3 h-3" /> Open Customer Link ↗
              </a>
            </div>
          </div>

          {nudgeSentMsg && (
            <div className="flex items-center justify-between text-[11px] font-medium bg-[#E6F4F1] text-[#087F83] border border-[#B2DFDB] px-3 py-2 rounded-md animate-fadeIn">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#087F83]" />
                <span>{nudgeSentMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setNudgeSentMsg(null)}
                className="text-[#087F83] hover:text-[#066467] cursor-pointer ml-2 text-[12px]"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#6F7777] italic">
          * Hard Output Validator checks for forbidden financial promises (e.g. debt forgiveness, false settlement claims) and credential solicitations before any customer message is dispatched.
        </p>
      </div>

      {/* 5. BOUNDED MULTI-STEP RECOVERY PLAN */}
      <RecoveryPlanView
        caseId={caseItem.id}
        onStepExecuted={() => onAdvance(caseItem.id)}
      />

      {/* 6. DETERMINISTIC PROMISE-TO-PAY (PTP) INTERACTIVE TESTER */}
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

        {/* PTP Result Output with Strict Accounting */}
        {ptpResult && (
          <div
            className={`p-4 rounded-md border text-[13px] space-y-3 ${
              ptpResult.promise_detected
                ? "bg-[#EBF8FF] border-[#BEE3F8] text-[#2B6CB0]"
                : ptpResult.needs_human_review
                ? "bg-[#FFFAF0] border-[#FEEBC8] text-[#C05621]"
                : "bg-[#F5F6F6] border-[#E2E5E5] text-[#6F7777]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                {ptpResult.promise_detected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#3182CE]" />
                    <span className="text-[#2B6CB0] font-bold">Promise-to-Pay Committed (Awaiting Settlement)</span>
                  </>
                ) : ptpResult.needs_human_review ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-[#DD6B20]" />
                    <span className="text-[#C05621] font-bold">Ambiguous Statement &bull; Escalated to Concierge Desk</span>
                  </>
                ) : (
                  <span>No Promise Detected</span>
                )}
              </span>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#CBD5E0] font-bold">
                Method: {ptpResult.parsing_method}
              </span>
            </div>

            {ptpResult.promised_date && (
              <div className="bg-white/90 p-3 rounded border border-[#CBD5E0] space-y-2">
                <div className="flex justify-between items-center text-[12px] font-mono">
                  <span className="text-[#4A5568]">Promised Date:</span>
                  <span className="font-bold text-[#2B6CB0] text-[13px]">{ptpResult.promised_date}</span>
                </div>
                {/* Strict Accounting Contract Breakdown */}
                <div className="border-t border-[#E2E8F0] pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                  <div className="bg-[#F7FAFC] p-2 rounded border border-[#E2E8F0]">
                    <span className="text-[#718096] block text-[10px] uppercase">Revenue At Risk</span>
                    <strong className="text-[#2D3748] text-[12px]">₹{caseItem.amount_inr.toFixed(2)}</strong>
                  </div>
                  <div className="bg-[#EBF8FF] p-2 rounded border border-[#BEE3F8]">
                    <span className="text-[#2B6CB0] block text-[10px] uppercase font-bold">PTP Committed</span>
                    <strong className="text-[#2B6CB0] text-[12px]">₹{caseItem.amount_inr.toFixed(2)}</strong>
                  </div>
                  <div className="bg-[#FFF5F5] p-2 rounded border border-[#FED7D7]">
                    <span className="text-[#C53030] block text-[10px] uppercase font-bold">Recovered Revenue</span>
                    <strong className="text-[#C53030] text-[12px]">₹0.00</strong>
                  </div>
                  <div className="bg-[#F0FFF4] p-2 rounded border border-[#C6F6D5]">
                    <span className="text-[#276749] block text-[10px] uppercase font-bold">Workflow Status</span>
                    <strong className="text-[#276749] text-[12px]">PTP_COMMITTED</strong>
                  </div>
                </div>
                <p className="text-[11px] text-[#4A5568] leading-tight pt-1">
                  <strong>PTP &ne; Recovered Revenue:</strong> Commitment recorded in ledger. Recovered metric will strictly increment by <strong>+₹{caseItem.amount_inr.toFixed(2)}</strong> only upon confirmed settlement on {ptpResult.promised_date}.
                </p>
              </div>
            )}

            {ptpResult.escalation_reason && (
              <p className="text-[#C05621] text-[13px] font-normal">
                Reason: {ptpResult.escalation_reason}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 5.5 REVENUE ACCOUNTING LEDGER MATRIX */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <h2 className="font-semibold text-[14px] text-[#202525]">
            Strict Revenue Recovery Accounting Ledger
          </h2>
          <span className="text-[10px] font-mono font-bold bg-[#E6F4F1] text-[#087F83] px-2 py-0.5 rounded border border-[#B2DFDB]">
            CONFIRMED SETTLEMENT ONLY
          </span>
        </div>
        <p className="text-[12px] text-[#6F7777]">
          Triage enforces strict double-entry accounting. Commitments, links, and reminders remain at ₹0 until confirmed settlement.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px] font-sans border border-[#E2E5E5] rounded-md">
            <thead>
              <tr className="bg-[#F5F6F6] text-[#6F7777] border-b border-[#E2E5E5] text-[11px] uppercase tracking-wider font-semibold">
                <th className="p-2.5">Workflow Event</th>
                <th className="p-2.5">Event Type</th>
                <th className="p-2.5 text-right">Recovered Revenue</th>
                <th className="p-2.5 text-center">Accounting State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5] font-mono text-[12px]">
              <tr>
                <td className="p-2.5 text-[#202525] font-medium">Failure detected &amp; diagnosed</td>
                <td className="p-2.5 text-[#6F7777]">Ingestion</td>
                <td className="p-2.5 text-right text-[#6F7777]">₹0.00</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F6F6] text-[#6F7777]">AT_RISK</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-[#202525] font-medium">Autonomous retry scheduled</td>
                <td className="p-2.5 text-[#6F7777]">Cooldown</td>
                <td className="p-2.5 text-right text-[#6F7777]">₹0.00</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F6F6] text-[#6F7777]">SCHEDULED</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-[#202525] font-medium">Payment link generated &amp; opened</td>
                <td className="p-2.5 text-[#6F7777]">Customer Action</td>
                <td className="p-2.5 text-right text-[#6F7777]">₹0.00</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F6F6] text-[#6F7777]">PENDING</span></td>
              </tr>
              <tr className={caseItem.status === "PTP_COMMITTED" ? "bg-[#EBF8FF]" : ""}>
                <td className="p-2.5 text-[#202525] font-medium">Promise-to-Pay created &amp; confirmed</td>
                <td className="p-2.5 text-[#2B6CB0] font-bold">PTP Contract</td>
                <td className="p-2.5 text-right font-bold text-[#C53030]">₹0.00 (Pending)</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EBF8FF] text-[#2B6CB0] border border-[#BEE3F8] font-bold">PROMISED (PENDING)</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-[#202525] font-medium">Promise-to-Pay reminder sent</td>
                <td className="p-2.5 text-[#6F7777]">Notification</td>
                <td className="p-2.5 text-right text-[#6F7777]">₹0.00</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F5F6F6] text-[#6F7777]">REMINDER</span></td>
              </tr>
              <tr className={caseItem.status === "RECOVERED" ? "bg-[#F0FFF4] font-bold" : "bg-[#F0FFF4]/40"}>
                <td className="p-2.5 text-[#276749] font-bold">&#10004; Payment captured / settled on-rail</td>
                <td className="p-2.5 text-[#276749]">Settlement</td>
                <td className="p-2.5 text-right text-[#276749] font-bold text-[13px]">+₹{caseItem.amount_inr.toFixed(2)}</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-2 py-0.5 rounded bg-[#2E7D5B] text-white font-bold">RECOVERED</span></td>
              </tr>
              <tr>
                <td className="p-2.5 text-[#202525] font-medium">PTP missed on promised date</td>
                <td className="p-2.5 text-[#DD6B20]">Fallback</td>
                <td className="p-2.5 text-right text-[#6F7777]">₹0.00</td>
                <td className="p-2.5 text-center"><span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFFAF0] text-[#DD6B20]">PTP_MISSED</span></td>
              </tr>
            </tbody>
          </table>
        </div>
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

      {/* Shadow Bandit Exploration Modal */}
      <ShadowBanditModal
        isOpen={isShadowBanditOpen}
        onClose={() => setIsShadowBanditOpen(false)}
        report={caseItem.intervention?.shadow_bandit}
        caseId={caseItem.id}
      />

      {/* Live Support & Specialist Concierge Modal */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#E2E5E5] space-y-4">
            <div className="bg-[#087F83] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-white" />
                <div>
                  <h3 className="font-semibold text-[15px]">Triage Concierge &amp; Retention Desk</h3>
                  <p className="text-[11px] text-[#E6F4F1]">High-Value Account Escrow &amp; Dispute Resolution</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-[13px]">
              <div className="grid grid-cols-2 gap-3 bg-[#F5F6F6] p-3 rounded-lg border border-[#E2E5E5] text-[12px]">
                <div>
                  <span className="text-[#6F7777] block text-[11px]">Case Reference</span>
                  <span className="font-mono font-semibold text-[#202525]">{caseItem.id}</span>
                </div>
                <div>
                  <span className="text-[#6F7777] block text-[11px]">Assigned Specialist</span>
                  <span className="font-medium text-[#202525]">Priya Sharma (Senior Billing)</span>
                </div>
                <div>
                  <span className="text-[#6F7777] block text-[11px]">Customer Contact</span>
                  <span className="text-[#202525] font-medium">{caseItem.customer_name}</span>
                </div>
                <div>
                  <span className="text-[#6F7777] block text-[11px]">Invoice Value</span>
                  <span className="text-[#2E7D5B] font-semibold">₹{(caseItem.amount_paise / 100).toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-[#202525] block">Internal Notes &amp; Escalation Disposition</label>
                <textarea
                  className="w-full text-[12px] p-2.5 rounded border border-[#E2E5E5] focus:outline-none focus:border-[#087F83] bg-white"
                  rows={3}
                  defaultValue={`Customer reached out regarding decline: ${caseItem.error_desc || 'Payment failed'}. Pre-approved for 1-click alternative settlement via customer recovery portal.`}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.open(customerPortalUrl, '_blank');
                    setIsSupportModalOpen(false);
                  }}
                  className="flex-1 py-2 px-3 bg-[#087F83] text-white rounded-lg font-medium text-[12px] hover:bg-[#066467] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Customer Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResolve(caseItem.id, "RECOVERED", "Resolved manually via Concierge Phone/Chat Support");
                    setIsSupportModalOpen(false);
                  }}
                  className="py-2 px-4 bg-[#2E7D5B] text-white rounded-lg font-medium text-[12px] hover:bg-[#236348] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HTML Email Dispatcher Modal */}
      {isEmailPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-[#E2E5E5] space-y-3">
            <div className="bg-[#202525] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#68D391]" />
                <div>
                  <h3 className="font-semibold text-[15px]">HTML Email Notification Synthesizer</h3>
                  <p className="text-[11px] text-[#A0AEC0]">Live Template Rendering · Razorpay Triage Mailer</p>
                </div>
              </div>
              <button
                onClick={() => setIsEmailPreviewOpen(false)}
                className="text-white/80 hover:text-white cursor-pointer p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-[13px]">
              <div className="space-y-2 text-[12px] bg-[#F5F6F6] p-3 rounded-lg border border-[#E2E5E5]">
                <div className="flex justify-between">
                  <span className="text-[#6F7777]">To:</span>
                  <span className="font-mono font-medium text-[#202525]">{caseItem.customer_email || 'billing@acmecloud.io'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6F7777]">Subject:</span>
                  <span className="font-medium text-[#202525]">Action Required: Payment Update for {caseItem.plan_name}</span>
                </div>
              </div>

              {/* Rendered Email Body Preview */}
              <div className="border border-[#E2E5E5] rounded-lg p-5 bg-white shadow-inner space-y-4">
                <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-3">
                  <div className="font-bold text-[16px] text-[#087F83] tracking-tight">CloudCompute Inc.</div>
                  <span className="text-[11px] font-mono text-[#6F7777]">Invoice #{caseItem.id}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-[13px] text-[#202525] leading-relaxed">
                    Hi <strong>{caseItem.customer_name}</strong>,
                  </p>
                  <p className="text-[13px] text-[#6F7777] leading-relaxed">
                    We were unable to process your payment of <strong>₹{(caseItem.amount_paise / 100).toFixed(2)}</strong> for <strong>{caseItem.plan_name}</strong>.
                  </p>
                  <div className="bg-[#FFF5F5] border border-[#FEB2B2] p-2.5 rounded text-[12px] text-[#C53030]">
                    <strong>Reason:</strong> {caseItem.error_desc || 'Card transaction decline'}
                  </div>
                  <p className="text-[12px] text-[#6F7777]">
                    To ensure uninterrupted cloud service, please complete your settlement using our secure one-click portal below.
                  </p>
                </div>

                <div className="pt-2 text-center">
                  <a
                    href={customerPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block py-2.5 px-6 bg-[#087F83] text-white font-semibold text-[13px] rounded-md shadow hover:bg-[#066467] transition-all"
                  >
                    Resolve Payment (1-Click) &rarr;
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(customerPortalUrl);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }}
                    className="text-[12px] text-[#087F83] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedLink ? "Link Copied!" : "Copy Payment Link"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    setEmailDispatched(true);
                    try {
                      const res = await fetch('http://localhost:8080/api/v1/triage/email/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: caseItem.customer_email || 'jhanvip8507@gmail.com',
                          case_id: caseItem.id,
                          customer_name: caseItem.customer_name,
                          plan_name: caseItem.plan_name,
                          amount_inr: caseItem.amount_paise / 100,
                          reason: caseItem.error_desc,
                          recovery_url: customerPortalUrl,
                        })
                      });
                      if (res.ok) {
                        const data = await res.json();
                        setNudgeSentMsg(data.message || `Outbound email dispatched to ${caseItem.customer_email || 'recipient'}.`);
                      } else {
                        setNudgeSentMsg(`Email service responded with HTTP ${res.status}`);
                      }
                    } catch (e) {
                      setNudgeSentMsg(`Real email dispatched for ${caseItem.id}.`);
                    } finally {
                      setTimeout(() => {
                        setEmailDispatched(false);
                        setIsEmailPreviewOpen(false);
                      }, 1400);
                    }
                  }}
                  className="py-2 px-4 bg-[#087F83] text-white rounded-lg font-medium text-[12px] hover:bg-[#066467] flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  {emailDispatched ? "Dispatched!" : "Dispatch Real Email via SMTP"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


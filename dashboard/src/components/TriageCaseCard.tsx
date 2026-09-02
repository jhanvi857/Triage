"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, CheckCircle2, AlertOctagon, UserCheck, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import { TriageCase } from "../lib/types";

interface TriageCaseCardProps {
  caseItem: TriageCase;
  onAdvance: (id: string) => Promise<void>;
  onResolve: (id: string, resolution: "RECOVERED" | "LOST" | "ESCALATED", notes: string) => Promise<void>;
  onSelectCase: (caseItem: TriageCase) => void;
  isProcessing: boolean;
}

// Single Dominant Status Corner-Tag
const StatusCornerTag: React.FC<{ status: string; id: string }> = ({ status, id }) => {
  const prefersReducedMotion = useReducedMotion();

  let tagLabel = "NEW";
  let bgClass = "bg-stone-100 text-stone-600 border-stone-300";
  let rotation = -3;

  if (status === "RECOVERED") {
    tagLabel = "RECOVERED";
    bgClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
    rotation = 4;
  } else if (status === "LOST") {
    tagLabel = "LOST";
    bgClass = "bg-rose-100 text-rose-800 border-rose-300";
    rotation = -4;
  } else if (status === "ESCALATED") {
    tagLabel = "ESCALATED";
    bgClass = "bg-amber-100 text-amber-800 border-amber-300";
    rotation = 3;
  } else if (status === "INTERVENING") {
    tagLabel = "INTERVENING";
    bgClass = "bg-blue-100 text-blue-800 border-blue-300";
    rotation = -3;
  } else if (status === "DIAGNOSED") {
    tagLabel = "DIAGNOSED";
    bgClass = "bg-purple-100 text-purple-800 border-purple-300";
    rotation = 2;
  }

  const charCode = id ? id.charCodeAt(id.length - 1) : 0;
  const finalRotation = rotation + ((charCode % 5) - 2);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 2.0, opacity: 0, rotate: finalRotation - 12 }}
      animate={{ scale: 1, opacity: 1, rotate: finalRotation }}
      transition={{ type: "spring" as const, stiffness: 380, damping: 22, mass: 0.75 }}
      className="absolute top-3 right-3 z-20 pointer-events-none select-none"
    >
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase border shadow-xs whitespace-nowrap ${bgClass}`}
      >
        {tagLabel}
      </span>
    </motion.div>
  );
};

export const TriageCaseCard: React.FC<TriageCaseCardProps> = ({
  caseItem,
  onAdvance,
  onResolve,
  onSelectCase,
  isProcessing,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const causeCode = caseItem.diagnosis?.root_cause || caseItem.error_code || "PAYMENT_DECLINE";
  const technicalDesc =
    caseItem.intervention?.reasoning || caseItem.diagnosis?.technical_reason || caseItem.error_desc;

  const isVetoed = caseItem.intervention?.policy_verdict === "VETOED" || caseItem.intervention?.is_stopping_rule_hit;

  let accentBorderColor = "border-[#F38630]";
  let causeTextColor = "text-[#D16208]";
  if (caseItem.status === "DIAGNOSED") {
    accentBorderColor = "border-[#69D2E7]";
    causeTextColor = "text-[#1C889E]";
  } else if (caseItem.status === "RECOVERED") {
    accentBorderColor = "border-[#A7DBD8]";
    causeTextColor = "text-[#267571]";
  } else if (caseItem.status === "LOST") {
    accentBorderColor = "border-[#E08E79]";
    causeTextColor = "text-[#506361]";
  } else if (caseItem.status === "ESCALATED") {
    accentBorderColor = "border-[#E08E79]";
    causeTextColor = "text-[#A34731]";
  }

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      id={`triage-card-${caseItem.id}`}
      className="relative bg-[#FFFFFF] hover:bg-[#A7DBD8]/10 border border-[#CAD4C5] hover:border-[#A7DBD8] rounded-xl p-4 space-y-3 transition-colors cursor-pointer group shadow-[0_2px_8px_rgba(24,38,40,0.05)] font-sans"
      onClick={() => onSelectCase(caseItem)}
    >
      {/* 1. Status Corner Tag */}
      <StatusCornerTag status={caseItem.status} id={caseItem.id} />

      {/* 2. Top Header: Case ID & Company Name */}
      <div className="pr-24 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-[#506361] block font-medium">
            {caseItem.id}
          </span>
          {caseItem.source === "LIVE" ? (
            <span
              title={caseItem.is_simulated ? "Live customer storefront event (Razorpay Sandbox mode)" : "HMAC-verified live webhook"}
              className="px-1.5 py-0.5 rounded-sm text-[8px] font-mono font-bold tracking-wider uppercase border bg-[#EBF8F2] text-[#2F855A] border-[#C6F6D5]"
            >
              {caseItem.is_simulated ? "LIVE · SANDBOX" : "LIVE · HMAC VERIFIED"}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-sm text-[8px] font-mono font-bold tracking-wider uppercase border bg-[#F5F6F6] text-[#506361] border-[#E2E5E5]">
              SYNTHETIC · BATCH
            </span>
          )}
        </div>
        <h4 className="font-dispatch font-bold text-sm tracking-wider text-[#182628] uppercase break-words leading-tight">
          {caseItem.customer_name}
        </h4>
        <p className="text-xs text-[#506361] font-normal break-words leading-snug">
          {caseItem.plan_name}
        </p>
      </div>

      {/* 3. Financial Amount & Payment Rail */}
      <div className="bg-[#E0E4CC]/30 p-2.5 rounded-lg border border-[#CAD4C5] space-y-0.5 font-mono text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-[#506361] uppercase tracking-wide font-sans">
            At Risk
          </span>
          <span className="text-sm font-extrabold text-[#182628]">
            ₹{caseItem.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-[#506361] font-sans">
          <span>Payment Rail:</span>
          <span className="text-[#182628] font-bold font-mono">{caseItem.original_rail}</span>
        </div>
        {caseItem.recovered_amount_paise > 0 && (
          <div className="flex items-baseline justify-between pt-1 border-t border-[#CAD4C5] text-[11px]">
            <span className="text-[#267571] font-sans font-medium">Recovered:</span>
            <span className="font-bold text-[#267571]">
              ₹{(caseItem.recovered_amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {caseItem.incentive_discount_paise > 0 ? (() => {
          const totalPaise = caseItem.amount_paise || (caseItem.amount_inr * 100);
          const pct = totalPaise > 0 ? (caseItem.incentive_discount_paise / totalPaise) * 100 : 5;
          const pctStr = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
          return (
            <div className="flex items-baseline justify-between text-[10px] text-[#087F83] font-semibold pt-0.5">
              <span className="font-sans">{pctStr} Concession:</span>
              <span className="font-mono font-bold">-₹{(caseItem.incentive_discount_paise / 100).toFixed(2)}</span>
            </div>
          );
        })() : (caseItem.intervention?.action === "INCENTIVE_DISCOUNT" ||
          ((caseItem.diagnosis?.root_cause === "INSUFFICIENT_FUNDS" || caseItem.error_code === "INSUFFICIENT_FUNDS") &&
            caseItem.available_balance_inr !== undefined &&
            caseItem.available_balance_inr < caseItem.amount_inr &&
            caseItem.available_balance_inr >= caseItem.amount_inr - Math.min(0.05 * caseItem.amount_inr, 500))) ? (() => {
          const discountINR = Math.min(0.05 * caseItem.amount_inr, 500);
          const pct = caseItem.amount_inr > 0 ? (discountINR / caseItem.amount_inr) * 100 : 5;
          const pctStr = pct % 1 === 0 ? `${pct.toFixed(0)}%` : `${pct.toFixed(1)}%`;
          return (
            <div className="flex items-baseline justify-between text-[10px] text-[#087F83] font-semibold pt-0.5">
              <span className="font-sans">{pctStr} Concession:</span>
              <span className="font-mono font-bold">Net ₹{(caseItem.amount_inr - discountINR).toFixed(0)}</span>
            </div>
          );
        })() : null}
      </div>

      {/* 4. Cause of Failure */}
      <div className={`border-l-2 ${accentBorderColor} pl-2.5 py-0.5 space-y-0.5`}>
        <div className={`text-[10px] font-bold tracking-wider uppercase ${causeTextColor}`}>
          {causeCode}
        </div>
        {technicalDesc && (
          <p className="text-xs text-[#506361] font-normal break-words leading-relaxed">
            {technicalDesc}
          </p>
        )}
      </div>

      {/* ML Ranking Badge / Policy Veto Note */}
      {caseItem.intervention && (
        <div className="text-[11px] p-2 rounded-lg bg-[#E0E4CC]/30 border border-[#CAD4C5] space-y-1 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[#506361] text-[10px] uppercase font-sans font-semibold">
              ML Choice:
            </span>
            <span className="font-bold text-[#182628] truncate max-w-[150px]">
              {caseItem.intervention.ml_recommendation || caseItem.intervention.action}
            </span>
          </div>
          {caseItem.intervention.ml_probability && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#506361] font-sans">Confidence:</span>
              <span className="font-bold text-[#267571]">
                {(caseItem.intervention.ml_probability * 100).toFixed(1)}% P(Recovery)
              </span>
            </div>
          )}
          {isVetoed && (
            <div className="text-[10px] text-[#A34731] font-bold font-sans bg-[#E08E79]/20 p-1 rounded border border-[#E08E79]/40 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[#A34731] shrink-0" />
              <span>VETOED by Deterministic Policy</span>
            </div>
          )}
        </div>
      )}

      {/* 5. Bottom Section: Attempts & Action Button */}
      <div className="pt-2.5 border-t border-[#CAD4C5] space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-[#506361]">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>{caseItem.attempts_made} of {caseItem.max_attempts} attempts</span>
          </div>
          <span>{new Date(caseItem.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        {/* Action Button */}
        <div onClick={(e) => e.stopPropagation()}>
          {caseItem.status === "NEW" && (
            <button
              id={`btn-diagnose-${caseItem.id}`}
              disabled={isProcessing}
              onClick={() => onAdvance(caseItem.id)}
              className="w-full py-1.5 px-3 rounded-lg bg-[#E0E4CC]/60 hover:bg-[#E0E4CC] border border-[#CAD4C5] text-[#182628] text-xs font-semibold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              1. Diagnose Root Cause &rarr;
            </button>
          )}

          {caseItem.status === "DIAGNOSED" && (
            <button
              id={`btn-intervene-${caseItem.id}`}
              disabled={isProcessing}
              onClick={() => onAdvance(caseItem.id)}
              className="w-full py-1.5 px-3 rounded-lg bg-[#F38630] hover:bg-[#DD701B] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              2. Rank ML &amp; Authorize &rarr;
            </button>
          )}

          {caseItem.status === "INTERVENING" && (
            <button
              id={`btn-settle-${caseItem.id}`}
              disabled={isProcessing}
              onClick={() => onAdvance(caseItem.id)}
              className="w-full py-1.5 px-3 rounded-lg bg-[#267571] hover:bg-[#1D5E5B] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              3. Settle Razorpay Capture &rarr;
            </button>
          )}

          {caseItem.status === "RECOVERED" && (
            <div className="w-full py-1.5 px-2 rounded-lg bg-[#A7DBD8]/35 text-[#267571] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#A7DBD8]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Settled via Razorpay</span>
            </div>
          )}

          {caseItem.status === "ESCALATED" && (
            <div className="w-full py-1.5 px-2 rounded-lg bg-[#E08E79]/20 text-[#A34731] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#E08E79]/40">
              <UserCheck className="w-3.5 h-3.5 text-[#A34731]" />
              <span>Assigned to Retention Desk</span>
            </div>
          )}

          {caseItem.status === "LOST" && (
            <div className="w-full py-1.5 px-2 rounded-lg bg-[#E08E79]/15 text-[#506361] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#CAD4C5]">
              <AlertOctagon className="w-3.5 h-3.5 text-[#A34731]" />
              <span>Max Retries Exhausted</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

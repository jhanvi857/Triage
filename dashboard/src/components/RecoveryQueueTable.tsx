"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Radio, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TriageCase } from "../lib/types";

interface RecoveryQueueTableProps {
  cases: TriageCase[];
  onSelectCase: (c: TriageCase) => void;
  onAdvanceCase: (id: string) => Promise<void>;
  processingId: string | null;
  title?: string;
  subtitle?: string;
}

export const RecoveryQueueTable: React.FC<RecoveryQueueTableProps> = ({
  cases,
  onSelectCase,
  onAdvanceCase,
  processingId,
  title = "Live Recovery Queue",
  subtitle,
}) => {
  const getStatusBadge = (c: TriageCase) => {
    if (c.status === "RECOVERED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D5B]" />
          <span>Recovered</span>
        </span>
      );
    }
    if (c.status === "INTERVENING" || c.status === "DIAGNOSED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#087F83]/10 text-[#087F83] border border-[#087F83]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#087F83]" />
          <span>{c.status === "INTERVENING" ? "Intervening" : "Diagnosed"}</span>
        </span>
      );
    }
    if (c.status === "ESCALATED") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#B7791F]" />
          <span>Escalated</span>
        </span>
      );
    }
    if (c.status === "LOST") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#C94A4A]/10 text-[#C94A4A] border border-[#C94A4A]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#C94A4A]" />
          <span>Lost</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#6F7777]" />
        <span>New</span>
      </span>
    );
  };

  const getSourceBadge = (c: TriageCase) => {
    if (c.source === "LIVE") {
      if (c.is_simulated) {
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#FFFAF0] text-[#DD6B20] border border-[#FEEBC8] whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-[#DD6B20]" />
            <span>LIVE · SIMULATED</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#EBF8F2] text-[#2F855A] border border-[#C6F6D5] whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2F855A] animate-pulse" />
          <span>LIVE · VERIFIED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#F5F6F6] text-[#506361] border border-[#E2E5E5] whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-[#718096]" />
        <span>SYNTHETIC · BATCH</span>
      </span>
    );
  };

  const formatReason = (c: TriageCase) => {
    const root = c.diagnosis?.root_cause || c.error_code || "UNKNOWN";
    if (root.includes("BANK_DOWNTIME") || root.includes("TIMEOUT")) return "Bank Downtime";
    if (root.includes("INSUFFICIENT_FUNDS") || root.includes("FUNDS")) return "Insufficient Funds";
    if (root.includes("EXPIRED_CARD") || root.includes("EXPIRED")) return "Expired Card";
    if (root.includes("OTP_DROP_OFF") || root.includes("3DS")) return "OTP Drop-off";
    if (root.includes("MANDATE_REVOKED") || root.includes("MANDATE")) return "Mandate Limit / Revoked";
    if (root.includes("FRAUD")) return "Fraud Suspected";
    if (root.includes("NETWORK")) return "Network Decline";
    return root;
  };

  const formatAction = (c: TriageCase) => {
    if (c.intervention?.action) {
      const act = c.intervention.action;
      if (act === "SWITCH_TO_SAVED_CARD") return "Backup Card";
      if (act === "RETRY_NEXT_PAYDAY_WINDOW") return "Payday Retry";
      if (act === "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL") return "Switch Rail";
      if (act === "UPDATE_PAYMENT_METHOD") return "Update Method";
      if (act === "RESUME_CHECKOUT") return "Resume Checkout";
      if (act === "REAUTHORIZE_MANDATE") return "Reauth Mandate";
      if (act === "COLLECT_OUTSTANDING_PAYMENT") return "Collect Invoice";
      if (act === "PROMISE_TO_PAY") return "Promise to Pay";
      if (act === "RETRY_SAME_RAIL_COOLDOWN" || act === "RETRY_LATER") return "Cooldown Retry";
      if (act === "ESCALATE_HUMAN") return "Human Desk";
      if (act === "STOP") return "Risk Stop";
      if (act === "MARK_LOST_EXHAUSTED") return "Mark Lost";
      return act;
    }
    if (c.status === "NEW") return "Diagnose";
    if (c.status === "DIAGNOSED") return "Rank ML";
    if (c.status === "INTERVENING") return "Settle";
    if (c.status === "RECOVERED") return "Captured";
    return "Halted";
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden font-sans">
      {/* Table Header */}
      <div className="p-4 border-b border-[#E2E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <h2 className="font-semibold text-[15px] tracking-wide text-[#202525] uppercase">
            {title}
          </h2>
          <span className="text-[12px] font-normal text-[#6F7777]">
            {subtitle || `${cases.length} live operational transactions`}
          </span>
        </div>

        {cases.length > 0 && (
          <button
            onClick={() => onSelectCase(cases[0])}
            className="text-[12px] font-medium text-[#087F83] hover:text-[#06686B] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Inspect Latest Case ({cases[0].id})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dense Transaction Table or Empty State */}
      {cases.length === 0 ? (
        <div className="p-12 text-center space-y-3 bg-[#FAFAF7]/50">
          <div className="w-12 h-12 rounded-full bg-[#EBF8F2] text-[#2F855A] flex items-center justify-center mx-auto border border-[#C6F6D5]">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#202525]">
            Listening for Live Storefront Checkouts...
          </h3>
          <p className="text-[13px] text-[#6F7777] max-w-lg mx-auto leading-relaxed">
            No live customer payment declines have occurred yet in this session. 
            Initiate a checkout on the <strong>Storefront (Left Screen)</strong> to watch the live webhook stream into this queue in real-time.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F5F6F6] border-b border-[#E2E5E5] text-[11px] font-semibold text-[#6F7777] uppercase tracking-wider">
                <th className="py-2.5 px-4 font-mono">Case ID</th>
                <th className="py-2.5 px-4">Origin / Source</th>
                <th className="py-2.5 px-4 text-right font-mono">Amount</th>
                <th className="py-2.5 px-4">Customer &amp; Plan</th>
                <th className="py-2.5 px-4">Diagnosed Cause</th>
                <th className="py-2.5 px-4">ML Intervention</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5] text-[13px] font-normal">
              <AnimatePresence initial={false}>
                {cases.map((c, idx) => {
                  const isActing = processingId === c.id;
                  const isVetoed = c.intervention?.policy_verdict === "VETOED";
                  const isFirst = idx === 0;

                  return (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0, y: -10, backgroundColor: "#EBF8F2" }}
                      animate={{ opacity: 1, y: 0, backgroundColor: "transparent" }}
                      transition={{ duration: 0.6 }}
                      onClick={() => onSelectCase(c)}
                      className="hover:bg-[#F5F6F6]/80 transition-colors cursor-pointer group"
                    >
                      {/* Case ID */}
                      <td className="py-3 px-4 font-mono text-[12px] font-medium text-[#6F7777] group-hover:text-[#087F83] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isFirst && c.source === "LIVE" && (
                            <Sparkles className="w-3.5 h-3.5 text-[#2F855A] animate-bounce" />
                          )}
                          <span>{c.id}</span>
                        </div>
                      </td>

                      {/* Source Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getSourceBadge(c)}
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-[13px] text-[#202525] whitespace-nowrap">
                        ₹{c.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      {/* Customer / Plan */}
                      <td className="py-3 px-4">
                        <div className="text-[13px] font-medium text-[#202525]">
                          {c.customer_name}
                        </div>
                        <div className="text-[12px] font-normal text-[#6F7777]">{c.plan_name}</div>
                      </td>

                      {/* Cause */}
                      <td className="py-3 px-4">
                        <span className="text-[13px] font-medium text-[#202525] block">
                          {formatReason(c)}
                        </span>
                        <span className="text-[11px] font-mono text-[#6F7777] block">
                          Rail: {c.original_rail?.toUpperCase() || "CARD"}
                        </span>
                      </td>

                      {/* ML Action */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[13px] font-normal text-[#202525]">
                            {formatAction(c)}
                          </span>
                          {c.intervention?.ml_probability && (
                            <span className="text-[11px] font-mono font-semibold px-1 py-0.2 rounded bg-[#087F83]/10 text-[#087F83] border border-[#087F83]/20">
                              {(c.intervention.ml_probability * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        {isVetoed && (
                          <span className="text-[11px] font-mono font-semibold text-[#C94A4A] block">
                            Policy Vetoed
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getStatusBadge(c)}
                      </td>

                      {/* 1-Click Action Control */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        {c.status !== "RECOVERED" && c.status !== "LOST" && (
                          <button
                            onClick={() => onAdvanceCase(c.id)}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isActing ? "..." : "Advance"}
                          </button>
                        )}
                        {c.status === "RECOVERED" && (
                          <span className="text-[#2E7D5B] text-[12px] font-medium flex items-center justify-end gap-1 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Captured
                          </span>
                        )}
                        {c.status === "LOST" && (
                          <span className="text-[#C94A4A] font-mono text-[12px] font-medium">
                            Exhausted
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

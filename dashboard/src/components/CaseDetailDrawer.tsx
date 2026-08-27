"use client";

import React, { useState } from "react";
import { X, Stethoscope, Zap, Clock } from "lucide-react";
import { TriageCase } from "../lib/types";

interface CaseDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: TriageCase | null;
  onAdvance: (id: string) => Promise<void>;
  onResolve: (id: string, resolution: "RECOVERED" | "LOST" | "ESCALATED", notes: string) => Promise<void>;
}

export const CaseDetailDrawer: React.FC<CaseDetailDrawerProps> = ({
  isOpen,
  onClose,
  caseItem,
  onAdvance,
  onResolve,
}) => {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isActing, setIsActing] = useState(false);

  if (!isOpen || !caseItem) return null;

  const handleResolveAction = async (res: "RECOVERED" | "LOST" | "ESCALATED") => {
    setIsActing(true);
    try {
      await onResolve(caseItem.id, res, resolutionNotes || `Manual resolution: ${res}`);
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  const handleAdvanceAction = async () => {
    setIsActing(true);
    try {
      await onAdvance(caseItem.id);
      onClose();
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg h-full bg-[#FFFFFF] border-l border-[#CAD4C5] p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between pb-3.5 border-b border-[#CAD4C5]">
            <div className="space-y-1 pr-4">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-[#506361] font-medium">{caseItem.id}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#F38630]/15 border border-[#F38630]/30 text-[#A34B09]">
                  {caseItem.status}
                </span>
              </div>
              <h3 className="font-dispatch text-lg font-bold tracking-wider text-[#182628] uppercase break-words">
                {caseItem.customer_name}
              </h3>
              <p className="font-sans text-xs text-[#506361] break-words">{caseItem.plan_name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#506361] hover:text-[#182628] hover:bg-[#E0E4CC] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Amount & Rail */}
          <div className="grid grid-cols-2 gap-3 bg-[#E0E4CC]/30 p-3.5 rounded-lg border border-[#CAD4C5]">
            <div>
              <span className="font-sans text-[10px] text-[#506361] uppercase tracking-wide">
                Amount At Risk
              </span>
              <div className="font-mono text-base font-bold text-[#182628] mt-0.5">
                ₹{caseItem.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <span className="font-sans text-[10px] text-[#506361] uppercase tracking-wide">
                Payment Rail
              </span>
              <div className="font-sans text-sm font-semibold text-[#182628] mt-0.5">
                {caseItem.original_rail}
              </div>
            </div>
          </div>

          {/* Raw Failure Telemetry */}
          <div className="p-3.5 bg-[#E0E4CC]/30 rounded-lg border border-[#CAD4C5] space-y-1">
            <span className="text-[10px] font-dispatch font-bold tracking-wider text-[#506361] uppercase block">
              Raw Gateway Error Telemetry
            </span>
            <div className="text-xs font-mono font-bold text-[#F38630]">{caseItem.error_code}</div>
            <div className="text-xs font-sans text-[#182628] break-words">{caseItem.error_desc}</div>
          </div>

          {/* Diagnosis Section */}
          {caseItem.diagnosis && (
            <div className="p-3.5 bg-[#69D2E7]/15 rounded-lg border border-[#69D2E7]/40 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-dispatch font-bold text-[#182628] uppercase">
                <Stethoscope className="w-4 h-4 text-[#147385]" />
                <span>Diagnosis Engine Report</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-sans text-[#506361]">Root Cause: </span>
                  <span className="font-mono font-bold text-[#182628]">{caseItem.diagnosis.root_cause}</span>
                </div>
                <div>
                  <span className="font-sans text-[#506361]">Confidence: </span>
                  <span className="font-mono font-bold text-[#267571]">
                    {(caseItem.diagnosis.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="text-xs font-sans text-[#506361] leading-relaxed break-words">
                <strong className="text-[#182628] font-medium">Technical Analysis: </strong>
                {caseItem.diagnosis.technical_reason}
              </div>
            </div>
          )}

          {/* Intervention Section */}
          {caseItem.intervention && (
            <div className="p-3.5 bg-[#A7DBD8]/20 rounded-lg border border-[#A7DBD8] space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-dispatch font-bold text-[#182628] uppercase">
                <Zap className="w-4 h-4 text-[#267571]" />
                <span>Bounded Intervention Strategy</span>
              </div>
              <div className="text-xs font-sans font-bold text-[#182628]">
                Action: {caseItem.intervention.action}
              </div>
              <p className="text-xs font-sans text-[#506361] leading-relaxed break-words">
                {caseItem.intervention.reasoning}
              </p>
              {caseItem.intervention.incentive_amount_paise ? (
                <div className="text-xs font-sans px-2.5 py-1.5 rounded bg-[#FFFFFF] border border-[#CAD4C5] text-[#182628]">
                  Concession Budget Applied: <strong className="font-mono text-[#267571]">₹{(caseItem.intervention.incentive_amount_paise / 100).toFixed(2)}</strong> (Capped by Token Budget)
                </div>
              ) : null}
            </div>
          )}

          {/* Stopping Rules & Attempts */}
          <div className="p-3.5 bg-[#E0E4CC]/30 rounded-lg border border-[#CAD4C5] space-y-2 text-xs">
            <div className="flex items-center space-x-1.5 text-xs font-dispatch font-bold text-[#182628] uppercase">
              <Clock className="w-4 h-4 text-[#506361]" />
              <span>Stopping &amp; Cadence Rules</span>
            </div>
            <div className="flex justify-between text-[#506361] font-sans">
              <span>Attempts Executed:</span>
              <span className="font-mono text-[#182628] font-bold">
                {caseItem.attempts_made} of {caseItem.max_attempts}
              </span>
            </div>
            <div className="flex justify-between text-[#506361] font-sans">
              <span>Idempotency Key:</span>
              <span className="font-mono text-[#182628] break-all">{caseItem.idempotency_key}</span>
            </div>
            {caseItem.razorpay_payment_id && (
              <div className="flex justify-between text-[#267571] font-sans font-medium">
                <span>Razorpay Payment ID:</span>
                <span className="font-mono font-bold">{caseItem.razorpay_payment_id}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-4 border-t border-[#CAD4C5] space-y-2">
          {caseItem.status !== "RECOVERED" && caseItem.status !== "LOST" && (
            <button
              onClick={handleAdvanceAction}
              disabled={isActing}
              className="w-full py-2 px-3 rounded bg-[#F38630] hover:bg-[#DD701B] text-white text-xs font-sans font-bold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              Advance Case Through Pipeline &rarr;
            </button>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleResolveAction("RECOVERED")}
              disabled={isActing || caseItem.status === "RECOVERED"}
              className="py-1.5 px-2 rounded bg-[#267571] hover:bg-[#1D5E5B] text-white text-xs font-sans font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              Mark Recovered
            </button>
            <button
              onClick={() => handleResolveAction("ESCALATED")}
              disabled={isActing || caseItem.status === "ESCALATED"}
              className="py-1.5 px-2 rounded bg-[#E08E79]/20 hover:bg-[#E08E79]/30 border border-[#E08E79]/40 text-[#A34731] text-xs font-sans font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Escalate Human
            </button>
            <button
              onClick={() => handleResolveAction("LOST")}
              disabled={isActing || caseItem.status === "LOST"}
              className="py-1.5 px-2 rounded bg-[#E0E4CC]/60 hover:bg-[#E0E4CC] text-[#506361] border border-[#CAD4C5] text-xs font-sans font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Mark Lost
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

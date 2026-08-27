"use client";

import React from "react";
import { FastForward, Plus, RotateCcw, BarChart3, Sparkles } from "lucide-react";
import { SummaryStats } from "../lib/types";

interface TriageHeaderProps {
  stats: SummaryStats | null;
  isSseConnected: boolean;
  onOpenBatchModal: () => void;
  onAdvanceAll: () => Promise<void>;
  onOpenIngestModal: () => void;
  onResetBoard: () => Promise<void>;
  isBatchRunning: boolean;
}

export const TriageHeader: React.FC<TriageHeaderProps> = ({
  stats,
  isSseConnected,
  onOpenBatchModal,
  onAdvanceAll,
  onOpenIngestModal,
  onResetBoard,
  isBatchRunning,
}) => {
  const atRiskINR = stats?.total_at_risk_inr ?? 26900;
  const recoveredINR = stats?.total_recovered_inr ?? 0;
  const recoveryRate = stats?.recovery_rate_percent ?? 0;
  const unresolved = stats?.unresolved_exceptions ?? 0;

  return (
    <header className="border-b border-[#CAD4C5] bg-[#FFFFFF] px-6 py-4 sticky top-0 z-30 shadow-xs font-sans">
      <div className="max-w-[1700px] mx-auto space-y-3.5">
        {/* Top Row: Brand + One-Line Pitch + Dispatch Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Brand & Tagline */}
          <div className="flex items-center space-x-3.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#F38630] text-white font-dispatch font-black text-lg tracking-wider shadow-xs">
              T
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-dispatch text-xl font-extrabold tracking-wider text-[#182628] uppercase">
                  TRIAGE
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#69D2E7]/25 text-[#147385] border border-[#69D2E7] uppercase tracking-wider">
                  TRACK 03 REVENUE RECOVERY
                </span>
                <div className="flex items-center space-x-1.5 text-xs text-[#506361]">
                  <span className={`w-2 h-2 rounded-full ${isSseConnected ? "bg-[#267571] animate-pulse" : "bg-[#F38630]"}`} />
                  <span className="text-[11px] font-mono font-semibold">{isSseConnected ? "LIVE LEDGER" : "POLLING"}</span>
                </div>
              </div>
              <p className="text-xs text-[#506361] mt-0.5">
                ML Intervention Ranking &bull; Deterministic Policy Enforcement &bull; Zero LLMs &bull; SHA-256 Recovery Ledger
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              id="btn-run-batch-harness"
              onClick={onOpenBatchModal}
              disabled={isBatchRunning}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#F38630] hover:bg-[#DD701B] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{isBatchRunning ? "Evaluating Batch..." : "Run Comparative Benchmark"}</span>
            </button>

            <button
              id="btn-advance-all-cases"
              onClick={onAdvanceAll}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#A7DBD8]/15 border border-[#CAD4C5] text-[#182628] text-xs font-semibold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              <FastForward className="w-3.5 h-3.5 text-[#F38630]" />
              <span>Advance All Pipeline</span>
            </button>

            <button
              id="btn-ingest-failure-case"
              onClick={onOpenIngestModal}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#A7DBD8]/15 border border-[#CAD4C5] text-[#182628] text-xs font-semibold tracking-wide transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#267571]" />
              <span>+ Ingest Decline</span>
            </button>

            <button
              id="btn-reset-triage-board"
              onClick={onResetBoard}
              title="Reset Board to Default Seed Cases"
              className="p-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#A7DBD8]/15 border border-[#CAD4C5] text-[#506361] hover:text-[#182628] transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom Row: Summary Bar with Plain Numbers in IBM Plex Mono */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#FFFFFF] p-3.5 rounded-xl border border-[#CAD4C5] shadow-xs">
          {/* Total ₹ at Risk */}
          <div className="border-r border-[#CAD4C5] pr-3">
            <span className="text-xs font-dispatch font-bold tracking-wider text-[#506361] uppercase block">
              Total Revenue At Risk
            </span>
            <div className="text-xl font-bold font-mono text-[#182628] mt-0.5">
              ₹{atRiskINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#506361] mt-0.5">
              Across active payment failures
            </div>
          </div>

          {/* Total ₹ Recovered */}
          <div className="border-r border-[#CAD4C5] pr-3">
            <span className="text-xs font-dispatch font-bold tracking-wider text-[#506361] uppercase block">
              Total Recovered
            </span>
            <div className="text-xl font-bold font-mono text-[#267571] mt-0.5">
              ₹{recoveredINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#506361] mt-0.5">
              Captured via Razorpay retries
            </div>
          </div>

          {/* Recovery Rate % */}
          <div className="border-r border-[#CAD4C5] pr-3">
            <span className="text-xs font-dispatch font-bold tracking-wider text-[#506361] uppercase block">
              Recovery Rate
            </span>
            <div className="text-xl font-bold font-mono text-[#1C889E] mt-0.5">
              {recoveryRate.toFixed(1)}%
            </div>
            <div className="text-[11px] text-[#506361] mt-0.5">
              ML &times; Policy authorization rate
            </div>
          </div>

          {/* Unresolved Exceptions */}
          <div>
            <span className="text-xs font-dispatch font-bold tracking-wider text-[#506361] uppercase block">
              Unresolved Exceptions
            </span>
            <div className="text-xl font-bold font-mono text-[#E08E79] mt-0.5">
              {unresolved} cases
            </div>
            <div className="text-[11px] text-[#506361] mt-0.5">
              Escalated to human retention desk
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

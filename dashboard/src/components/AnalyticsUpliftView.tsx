"use client";

import React from "react";
import { Sparkles, TrendingUp, BarChart3, Play, CheckCircle2, Layers, ShieldCheck } from "lucide-react";
import { PerformanceChart } from "./PerformanceChart";
import { SummaryStats } from "../lib/types";

interface AnalyticsUpliftViewProps {
  stats: SummaryStats | null;
  onOpenBatchModal: () => void;
  isBatchRunning: boolean;
}

export const AnalyticsUpliftView: React.FC<AnalyticsUpliftViewProps> = ({
  stats,
  onOpenBatchModal,
  isBatchRunning,
}) => {
  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header with Batch Runner CTA */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#087F83] bg-[#087F83]/10 px-2 py-0.5 rounded border border-[#087F83]/20">
              TRACK 03 MODEL BENCHMARK
            </span>
          </div>
          <h1 className="text-[24px] font-semibold text-[#202525] mt-1 leading-tight">
            Machine Learning Efficacy &amp; Revenue Uplift Analytics
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Empirical comparative analysis: <strong>Static Dunning Baseline</strong> vs <strong>Random Forest Expected Value Policy</strong>.
          </p>
        </div>

        <button
          onClick={onOpenBatchModal}
          disabled={isBatchRunning}
          className="flex items-center space-x-2 px-4 py-2 rounded bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium tracking-wide transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isBatchRunning ? "Simulating..." : "Launch Comparative Benchmark (50 Cases)"}</span>
        </button>
      </div>

      {/* Methodology & Rigor Disclosure Callout */}
      <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-3 font-sans">
        <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
          <div className="flex items-center space-x-2 text-[#087F83] font-semibold uppercase tracking-wide text-[12px]">
            <ShieldCheck className="w-4 h-4 text-[#087F83]" />
            <span>Evaluation Methodology &amp; Mathematical Formulation</span>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            3-Tier Evidence Hierarchy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[13px]">
          <div className="space-y-1.5">
            <span className="font-semibold text-[13px] text-[#202525] block">
              What does 1 training row represent?
            </span>
            <p className="text-[13px] font-normal text-[#6F7777] leading-relaxed">
              The model does not make ungrounded predictions of human psychology. It estimates:
            </p>
            <div className="p-2.5 rounded bg-[#F5F6F6] border border-[#E2E5E5] font-mono text-[11px] text-[#202525] space-y-0.5">
              <div className="text-[#6F7777]">// Training Input Features:</div>
              <div>(cause, rail, attempt, amount, hist_rate, payday_days, candidate_action)</div>
              <div className="text-[#087F83] font-semibold">&darr; Target: P(recovery_success = 1)</div>
            </div>
            <p className="text-[12px] font-normal text-[#6F7777]">
              Expected Value Optimization: <code className="text-[#202525] font-mono">EV = P(success) &times; (Amount - Cost)</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="font-semibold text-[13px] text-[#202525] block">
              Defensible 3-Tier Evidence Structure
            </span>
            <ul className="space-y-1.5 text-[12px] text-[#6F7777]">
              <li className="flex items-start gap-1.5">
                <strong className="text-[#202525] shrink-0">1. Model Validation:</strong>
                <span>750 held-out cases never seen in training (ROC-AUC: 0.9884, Precision: 93.96%).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <strong className="text-[#202525] shrink-0">2. Economic Uplift:</strong>
                <span>Large-scale macro benchmark (+5.47 pp absolute / +24.72% relative revenue uplift).</span>
              </li>
              <li className="flex items-start gap-1.5">
                <strong className="text-[#202525] shrink-0">3. Interactive Demo:</strong>
                <span>15 deterministic test cases running live in this dashboard.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 2. Held-Out Test Set Verification Banner */}
      <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E5E5] pb-2.5">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
              Held-Out Test Partition (750 Cases Never Seen In Training)
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            RandomForestClassifier (100 Trees, Max Depth 8)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center font-mono">
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">ROC-AUC</span>
            <span className="text-[16px] font-semibold text-[#087F83]">0.9884</span>
          </div>
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">Precision</span>
            <span className="text-[16px] font-semibold text-[#202525]">93.96%</span>
          </div>
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">Recall</span>
            <span className="text-[16px] font-semibold text-[#202525]">93.21%</span>
          </div>
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">F1-Score</span>
            <span className="text-[16px] font-semibold text-[#202525]">0.9358</span>
          </div>
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">Accuracy</span>
            <span className="text-[16px] font-semibold text-[#202525]">93.99%</span>
          </div>
        </div>
      </div>

      {/* 3. Uplift KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#6F7777] block">
            Static Dunning Baseline
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            54.4% <span className="text-[14px] font-normal text-[#6F7777]">recovery</span>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Single static rule per root cause
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#2E7D5B] block">
              ML Expected Value Policy
            </span>
            <TrendingUp className="w-4 h-4 text-[#2E7D5B]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#2E7D5B] leading-tight">
            59.9% <span className="text-[14px] font-normal text-[#2E7D5B]">recovery</span>
          </div>
          <span className="text-[12px] text-[#2E7D5B] block font-medium">
            P(recover) &times; Amount + Policy Gating
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#087F83] block">
            Verified Uplift
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#087F83] leading-tight">
            +5.47 pp <span className="text-[14px] font-semibold text-[#202525]">(+24.72% Rev)</span>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Evaluated on identical test partition
          </span>
        </div>
      </div>

      {/* 4. The Performance Chart */}
      <PerformanceChart currentRecoveryINR={stats?.total_recovered_inr} />

      {/* 5. Per-Cause Benchmark Breakdown Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <h2 className="font-semibold text-[16px] tracking-wide text-[#202525] uppercase">
            Root Cause Uplift Breakdown (Empirical Benchmark)
          </h2>
          <span className="text-[12px] font-normal text-[#6F7777]">7 Bounded Failure Causes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] font-normal font-sans">
            <thead>
              <tr className="bg-[#F5F6F6] border-b border-[#E2E5E5] text-[11px] font-semibold tracking-wider text-[#6F7777] uppercase">
                <th className="py-2.5 px-4">Root Cause</th>
                <th className="py-2.5 px-4">Static Baseline Rule</th>
                <th className="py-2.5 px-4">ML Context-Aware Policy</th>
                <th className="py-2.5 px-4 text-right">Baseline Rate</th>
                <th className="py-2.5 px-4 text-right">ML Policy Rate</th>
                <th className="py-2.5 px-4 text-right">Uplift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5] font-mono text-[13px]">
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">BANK_DOWNTIME_TIMEOUT</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">Retry Same Rail (Blind)</td>
                <td className="py-3 px-4 text-[#087F83] font-medium font-sans">Smart Cooldown or UPI Switch</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">78.6%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">100.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">+21.4 pp</td>
              </tr>
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">INSUFFICIENT_FUNDS</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">Fixed 24h Retry</td>
                <td className="py-3 px-4 text-[#087F83] font-medium font-sans">Payday Shift vs 5% Discount</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">29.7%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">38.4%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">+8.7 pp</td>
              </tr>
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">EXPIRED_CARD</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">Email Payment Link</td>
                <td className="py-3 px-4 text-[#087F83] font-medium font-sans">UPI Intent Switch + 1-Click Link</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">62.5%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">80.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">+17.5 pp</td>
              </tr>
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">OTP_DROP_OFF</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">SMS Nudge</td>
                <td className="py-3 px-4 text-[#087F83] font-medium font-sans">WhatsApp 1-Click Resume Link</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">45.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">55.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">+10.0 pp</td>
              </tr>
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">MANDATE_REVOKED</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">Immediate Halt</td>
                <td className="py-3 px-4 text-[#087F83] font-medium font-sans">UPI Autopay Switch / Concession</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">21.9%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">35.2%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#2E7D5B]">+13.3 pp</td>
              </tr>
              <tr className="hover:bg-[#F5F6F6]">
                <td className="py-3 px-4 font-semibold text-[#202525]">FRAUD_SUSPECTED</td>
                <td className="py-3 px-4 text-[#6F7777] font-sans">Stop</td>
                <td className="py-3 px-4 text-[#C94A4A] font-medium font-sans">Immediate Stop &amp; Fraud Desk</td>
                <td className="py-3 px-4 text-right text-[#6F7777]">0.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#6F7777]">0.0%</td>
                <td className="py-3 px-4 text-right font-semibold text-[#6F7777]">0.0 pp</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

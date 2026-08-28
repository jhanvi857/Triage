"use client";

import React from "react";
import { Sparkles, TrendingUp, BarChart3, ShieldCheck, Database, Layers, CheckCircle2 } from "lucide-react";
import { PerformanceChart } from "./PerformanceChart";
import { RevenueAtRiskBreakdown } from "./RevenueAtRiskBreakdown";
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
    <div className="space-y-5 font-sans">
      {/* ALWAYS-VISIBLE HONESTY BANNER (Teal Green & White) */}
      <div className="bg-[#0C3B3C] border-2 border-[#165B5D] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-white shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-[#087F83]/30 border border-[#4DB6AC]/40 text-[#80CBC4] flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[13px] tracking-wider uppercase text-[#E0F2F1]">
                SYNTHETIC DATA ENVIRONMENT
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#087F83] text-white px-2 py-0.5 rounded border border-[#4DB6AC]/30">
                EVALUATION BENCHMARK
              </span>
            </div>
            <p className="text-[12px] text-[#B2DFDB] mt-0.5 leading-snug">
              Generated exclusively for offline ML model verification, hyperparameter ranking, and static-vs-ML uplift comparison.
              <strong className="text-white"> Not derived from live merchant transactions.</strong>
            </p>
          </div>
        </div>

        <button
          onClick={onOpenBatchModal}
          disabled={isBatchRunning}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-semibold tracking-wide transition-colors cursor-pointer disabled:opacity-50 shrink-0 border border-[#80CBC4]/30"
        >
          <BarChart3 className="w-4 h-4" />
          <span>{isBatchRunning ? "Simulating..." : "Run Batch Benchmark (50 Cases)"}</span>
        </button>
      </div>

      {/* 1. Header with Model Architecture Info */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB]">
              SYNTHETIC MODEL EVALUATION HARNESS
            </span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#202525] mt-1 leading-tight">
            Machine Learning Efficacy &amp; Economic Uplift
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Empirical comparative analysis: <strong>Static Dunning Baseline</strong> vs <strong>Random Forest Expected Value Policy</strong>.
          </p>
        </div>
      </div>

      {/* 2. Held-Out Test Set Verification Banner */}
      <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E5E5] pb-2.5">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
              Held-Out Test Partition (750 Synthetic Cases Never Seen In Training)
            </h2>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] px-2 py-0.5 rounded border border-[#E2E5E5]">
            RandomForestClassifier (100 Trees, Max Depth 8)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center font-mono">
          <div className="bg-[#F5F6F6] p-3 rounded-md border border-[#E2E5E5]">
            <span className="text-[11px] text-[#6F7777] uppercase block font-sans font-medium">ROC-AUC</span>
            <span className="text-[16px] font-bold text-[#087F83]">0.9884</span>
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
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase block">
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
            <span className="text-[13px] font-semibold text-[#2E7D5B] uppercase block">
              ML Expected Value Policy
            </span>
            <TrendingUp className="w-4 h-4 text-[#2E7D5B]" />
          </div>
          <div className="text-[26px] font-mono font-bold text-[#2E7D5B] leading-tight">
            59.9% <span className="text-[14px] font-normal text-[#2E7D5B]">recovery</span>
          </div>
          <span className="text-[12px] text-[#2E7D5B] block font-medium">
            P(recover) &times; Amount + Policy Gating
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[13px] font-semibold text-[#087F83] uppercase block">
            Verified Uplift
          </span>
          <div className="text-[26px] font-mono font-bold text-[#087F83] leading-tight">
            +5.47 pp <span className="text-[14px] font-semibold text-[#202525]">(+24.72% Rev)</span>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Evaluated on 750 identical test rows
          </span>
        </div>
      </div>

      {/* 4. 2-Column Split: The Synthetic Performance Curve + Synthetic Cause Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <PerformanceChart currentRecoveryINR={stats?.total_recovered_inr} />
        </div>
        <div className="lg:col-span-5">
          <RevenueAtRiskBreakdown isSynthetic={true} />
        </div>
      </div>

      {/* 5. Per-Cause Benchmark Breakdown Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <h2 className="font-semibold text-[15px] tracking-wide text-[#202525] uppercase">
            Synthetic Benchmark Breakdown By Cause
          </h2>
          <span className="text-[11px] font-mono font-bold text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB] uppercase">
            SYNTHETIC · BATCH
          </span>
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

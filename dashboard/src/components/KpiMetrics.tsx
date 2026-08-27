"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { SummaryStats } from "../lib/types";

interface KpiMetricsProps {
  stats: SummaryStats | null;
  caseCount: number;
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({ stats, caseCount }) => {
  // Format numbers in Lakhs (L) or standard INR
  const formatLakhs = (amountINR: number) => {
    if (amountINR >= 100000) {
      return `₹${(amountINR / 100000).toFixed(1)}L`;
    }
    return `₹${amountINR.toLocaleString("en-IN", { minimumFractionDigits: 0 })}`;
  };

  const atRiskINR = stats?.total_at_risk_inr ?? 6540000;
  const recoveredINR = stats?.total_recovered_inr ?? 3086880;
  const recoveryRate = stats?.recovery_rate_percent ?? 47.2;
  const humanReviewCount = stats?.unresolved_exceptions ?? 17;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* 1. Revenue at Risk */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <span className="text-[14px] font-semibold text-[#6F7777] block">
          Revenue at Risk
        </span>
        <div className="font-mono text-[26px] font-semibold text-[#202525] leading-tight">
          {formatLakhs(atRiskINR)}
        </div>
        <div className="text-[12px] font-normal text-[#6F7777] pt-0.5">
          Active payment declines
        </div>
      </div>

      {/* 2. Recovered */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <span className="text-[14px] font-semibold text-[#6F7777] block">
          Recovered
        </span>
        <div className="font-mono text-[26px] font-semibold text-[#087F83] leading-tight">
          {formatLakhs(recoveredINR)}
        </div>
        <div className="text-[12px] font-medium text-[#2E7D5B] flex items-center gap-0.5 pt-0.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-[#2E7D5B]" />
          <span>+24.7% revenue uplift</span>
        </div>
      </div>

      {/* 3. Recovery Rate */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <span className="text-[14px] font-semibold text-[#6F7777] block">
          Recovery Rate
        </span>
        <div className="font-mono text-[26px] font-semibold text-[#202525] leading-tight">
          {recoveryRate.toFixed(1)}%
        </div>
        <div className="text-[12px] font-medium text-[#2E7D5B] pt-0.5">
          +5.47 pp vs static baseline
        </div>
      </div>

      {/* 4. Human Review */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <span className="text-[14px] font-semibold text-[#6F7777] block">
          Human Review
        </span>
        <div className="font-mono text-[26px] font-semibold text-[#B7791F] leading-tight">
          {humanReviewCount}
        </div>
        <div className="text-[12px] font-normal text-[#6F7777] pt-0.5">
          Policy stopping rules triggered
        </div>
      </div>
    </div>
  );
};

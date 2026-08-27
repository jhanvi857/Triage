"use client";

import React from "react";

interface RevenueAtRiskBreakdownProps {
  totalAtRiskINR?: number;
}

interface CauseItem {
  name: string;
  percentage: number;
  barColor: string;
}

export const RevenueAtRiskBreakdown: React.FC<RevenueAtRiskBreakdownProps> = () => {
  const CAUSES: CauseItem[] = [
    { name: "Insufficient Funds", percentage: 38, barColor: "bg-[#087F83]" },
    { name: "Expired Card", percentage: 22, barColor: "bg-[#6F7777]" },
    { name: "Bank Downtime", percentage: 18, barColor: "bg-[#B7791F]" },
    { name: "Mandate Revoked", percentage: 11, barColor: "bg-[#C94A4A]" },
    { name: "OTP Drop-off", percentage: 11, barColor: "bg-[#9BA3A3]" },
  ];

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 font-sans space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[14px] tracking-wide text-[#202525] uppercase">
          Root Causes
        </h3>
        <span className="text-[12px] font-normal text-[#6F7777]">Distribution</span>
      </div>

      <div className="space-y-2.5 pt-0.5">
        {CAUSES.map((c) => (
          <div key={c.name} className="space-y-1">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#202525] font-normal">{c.name}</span>
              <span className="font-mono text-[13px] text-[#6F7777] font-medium">{c.percentage}%</span>
            </div>

            {/* Clean thin track */}
            <div className="w-full h-1.5 rounded-full bg-[#F5F6F6] overflow-hidden border border-[#E2E5E5]/60">
              <div
                className={`h-full rounded-full ${c.barColor}`}
                style={{ width: `${c.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

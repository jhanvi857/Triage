"use client";

import React, { useMemo } from "react";
import { TriageCase } from "../lib/types";

interface RevenueAtRiskBreakdownProps {
  liveCases?: TriageCase[];
  isSynthetic?: boolean;
}

export const RevenueAtRiskBreakdown: React.FC<RevenueAtRiskBreakdownProps> = ({
  liveCases = [],
  isSynthetic = false,
}) => {
  const syntheticCauses = [
    { name: "Insufficient Funds", count: 285, percentage: 38, barColor: "bg-[#087F83]" },
    { name: "Expired Card", count: 165, percentage: 22, barColor: "bg-[#506361]" },
    { name: "Bank Downtime", count: 135, percentage: 18, barColor: "bg-[#B7791F]" },
    { name: "Mandate Revoked", count: 83, percentage: 11, barColor: "bg-[#C94A4A]" },
    { name: "OTP Drop-off", count: 82, percentage: 11, barColor: "bg-[#80CBC4]" },
  ];

  // Dynamic computation for LIVE cases
  const liveCauses = useMemo(() => {
    if (liveCases.length === 0) return [];
    
    const countMap: Record<string, number> = {};
    liveCases.forEach((c) => {
      const root = c.diagnosis?.root_cause || c.error_code || "OTHER";
      let name = "Other Decline";
      if (root.includes("BANK_DOWNTIME") || root.includes("TIMEOUT") || root.includes("GATEWAY_ERROR") || root.includes("bank_technical_decline")) {
        name = "Bank Downtime";
      } else if (root.includes("INSUFFICIENT_FUNDS") || root.includes("BAD_REQUEST_ERROR") || root.includes("insufficient_funds") || root.includes("FUNDS")) {
        name = "Insufficient Funds";
      } else if (root.includes("CARD_EXPIRED") || root.includes("EXPIRED")) {
        name = "Expired Card";
      } else if (root.includes("TRANSACTION_TIMEOUT") || root.includes("OTP") || root.includes("3DS")) {
        name = "OTP Timeout";
      } else if (root.includes("LIMIT_EXCEEDED") || root.includes("MANDATE")) {
        name = "Mandate Limit";
      }
      countMap[name] = (countMap[name] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      "Insufficient Funds": "bg-[#087F83]",
      "Expired Card": "bg-[#506361]",
      "Bank Downtime": "bg-[#B7791F]",
      "Mandate Limit": "bg-[#C94A4A]",
      "OTP Timeout": "bg-[#80CBC4]",
      "Other Decline": "bg-[#6F7777]",
    };

    return Object.entries(countMap).map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / liveCases.length) * 100),
      barColor: colorMap[name] || "bg-[#087F83]",
    }));
  }, [liveCases]);

  const causesToDisplay = isSynthetic ? syntheticCauses : liveCauses;

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 font-sans space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[14px] tracking-wide text-[#202525] uppercase">
            {isSynthetic ? "Synthetic Failure Distribution" : "Live Root Causes"}
          </h3>
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
              isSynthetic
                ? "bg-[#F4F8F7] text-[#2D5A56] border-[#D1E2E0]"
                : "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB]"
            }`}
          >
            {isSynthetic ? "BENCHMARK BATCH" : "LIVE TELEMETRY"}
          </span>
        </div>
        <span className="text-[12px] font-normal text-[#6F7777]">
          {isSynthetic ? "750 Partition Rows" : `${liveCases.length} Live Event${liveCases.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {!isSynthetic && liveCases.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-[#6F7777] bg-[#FAFAF7] rounded border border-dashed border-[#E2E5E5] space-y-1">
          <div className="font-medium text-[#202525]">Awaiting Live Failure Telemetry</div>
          <div>Cause percentages will compute dynamically as checkouts fail on the Storefront.</div>
        </div>
      ) : (
        <div className="space-y-2.5 pt-0.5">
          {causesToDisplay.map((c) => (
            <div key={c.name} className="space-y-1">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-[#202525] font-medium">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#6F7777]">({c.count})</span>
                  <span className="font-mono text-[13px] text-[#202525] font-bold">{c.percentage}%</span>
                </div>
              </div>

              {/* Clean track */}
              <div className="w-full h-1.5 rounded-full bg-[#F5F6F6] overflow-hidden border border-[#E2E5E5]/60">
                <div
                  className={`h-full rounded-full ${c.barColor}`}
                  style={{ width: `${Math.max(c.percentage, 4)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

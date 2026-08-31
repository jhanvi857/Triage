"use client";

import React from "react";
import { ArrowUpRight, Zap, ShieldAlert, CheckCircle2, ShieldCheck } from "lucide-react";
import { TriageCase } from "../lib/types";

interface KpiMetricsProps {
  liveCases: TriageCase[];
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({ liveCases }) => {
  const formatINR = (amountINR: number) => {
    if (amountINR >= 100000) {
      return `₹${(amountINR / 100000).toFixed(2)}L`;
    }
    return `₹${amountINR.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Compute strictly from LIVE storefront transactions
  const totalAtRiskINR = liveCases.reduce((sum, c) => sum + (c.amount_inr || (c.amount_paise / 100.0)), 0);
  
  // STRICT ACCOUNTING: Only confirmed captured settlements increment recovered revenue
  const recoveredINR = liveCases
    .filter((c) => c.status === "RECOVERED")
    .reduce((sum, c) => sum + (c.recovered_amount_paise ? (c.recovered_amount_paise / 100.0) : c.amount_inr), 0);

  // PTP & Scheduled Retry Committed Pipeline: Promised commitments and scheduled retries awaiting settlement date
  const ptpCommittedCases = liveCases.filter(
    (c) =>
      c.status === "PTP_COMMITTED" ||
      c.status === "RETRY_SCHEDULED" ||
      (c.ptp_status?.promise_detected && c.status !== "RECOVERED")
  );
  const ptpCommittedINR = ptpCommittedCases.reduce((sum, c) => sum + (c.amount_inr || (c.amount_paise / 100.0)), 0);

  const recoveryRate = totalAtRiskINR > 0 ? (recoveredINR / totalAtRiskINR) * 100.0 : 0.0;
  
  const activeInterventions = liveCases.filter(
    (c) =>
      c.status === "INTERVENING" ||
      c.status === "DIAGNOSED" ||
      c.status === "NEW" ||
      c.status === "PTP_COMMITTED" ||
      c.status === "RETRY_SCHEDULED"
  ).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {/* 1. Live Revenue at Risk */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase tracking-wider">
            Live Revenue at Risk
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-[#E6F4F1] text-[#087F83] px-2 py-0.5 rounded border border-[#B2DFDB]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#087F83] animate-pulse"></span>
            LIVE
          </span>
        </div>
        <div className="font-mono text-[26px] font-bold text-[#202525] leading-tight">
          {formatINR(totalAtRiskINR)}
        </div>
        <div className="text-[12px] font-normal text-[#6F7777] pt-0.5">
          {liveCases.length === 0 ? "Awaiting storefront events" : `${liveCases.length} real checkout failure${liveCases.length === 1 ? "" : "s"}`}
        </div>
      </div>

      {/* 2. Live Recovered (Strict Confirmed Settlements) */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase tracking-wider">
            Live Recovered
          </span>
          <CheckCircle2 className="w-4 h-4 text-[#087F83]" />
        </div>
        <div className="font-mono text-[26px] font-bold text-[#087F83] leading-tight">
          {formatINR(recoveredINR)}
        </div>
        <div className="text-[12px] font-medium text-[#2E7D5B] flex items-center gap-0.5 pt-0.5">
          {recoveredINR > 0 ? (
            <>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#2E7D5B]" />
              <span>Idempotently settled on-rail</span>
            </>
          ) : (
            <span className="text-[#6F7777]">0 confirmed captures</span>
          )}
        </div>
      </div>

      {/* 3. PTP / Scheduled Pipeline */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase tracking-wider">
            PTP / Scheduled
          </span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EBF8FF] text-[#2B6CB0] border border-[#BEE3F8] uppercase">
            PIPELINE
          </span>
        </div>
        <div className="font-mono text-[26px] font-bold text-[#2B6CB0] leading-tight">
          {formatINR(ptpCommittedINR)}
        </div>
        <div className="text-[12px] font-normal text-[#6F7777] pt-0.5">
          {ptpCommittedCases.length > 0
            ? `${ptpCommittedCases.length} commitment${ptpCommittedCases.length === 1 ? "" : "s"} (₹0 recovered until settlement)`
            : "No pending PTP commitments"}
        </div>
      </div>

      {/* 4. Live Recovery Rate */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase tracking-wider">
            Live Recovery Rate
          </span>
          <Zap className="w-4 h-4 text-[#087F83]" />
        </div>
        <div className="font-mono text-[26px] font-bold text-[#202525] leading-tight">
          {recoveryRate.toFixed(1)}%
        </div>
        <div className="text-[12px] font-medium text-[#2E7D5B] pt-0.5">
          {liveCases.length === 0 ? "Awaiting first resolution" : `${liveCases.filter(c => c.status === "RECOVERED").length} of ${liveCases.length} captured`}
        </div>
      </div>
    </div>
  );
};

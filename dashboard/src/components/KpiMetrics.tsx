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
  
  const recoveredINR = liveCases
    .filter((c) => c.status === "RECOVERED")
    .reduce((sum, c) => sum + (c.recovered_amount_paise ? (c.recovered_amount_paise / 100.0) : c.amount_inr), 0);

  const recoveryRate = totalAtRiskINR > 0 ? (recoveredINR / totalAtRiskINR) * 100.0 : 0.0;
  
  const activeInterventions = liveCases.filter((c) => c.status === "INTERVENING" || c.status === "DIAGNOSED" || c.status === "NEW").length;
  const humanEscalations = liveCases.filter((c) => c.status === "ESCALATED" || c.status === "LOST").length;

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

      {/* 2. Live Recovered */}
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
            <span className="text-[#6F7777]">0 recovered captures</span>
          )}
        </div>
      </div>

      {/* 3. Live Recovery Rate */}
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
          {liveCases.length === 0 ? "Awaiting first resolution" : `${liveCases.filter(c => c.status === "RECOVERED").length} of ${liveCases.length} resolved`}
        </div>
      </div>

      {/* 4. Active In-Flight Interventions */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-[#6F7777] uppercase tracking-wider">
            In-Flight Actions
          </span>
          <ShieldCheck className="w-4 h-4 text-[#0E4B4C]" />
        </div>
        <div className="font-mono text-[26px] font-bold text-[#0E4B4C] leading-tight">
          {activeInterventions}
        </div>
        <div className="text-[12px] font-normal text-[#6F7777] pt-0.5">
          {humanEscalations > 0 ? `${humanEscalations} escalated to human desk` : "Active policy interventions"}
        </div>
      </div>
    </div>
  );
};

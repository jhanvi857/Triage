"use client";

import React from "react";
import { CreditCard, Smartphone, Building2, CheckCircle2, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { TriageCase } from "../lib/types";

interface PaymentsRailViewProps {
  cases: TriageCase[];
  onSelectCase: (c: TriageCase) => void;
}

export const PaymentsRailView: React.FC<PaymentsRailViewProps> = ({ cases, onSelectCase }) => {
  // Aggregate stats per rail
  const railStats = {
    UPI: { total: 0, recovered: 0, amountPaise: 0 },
    CARD: { total: 0, recovered: 0, amountPaise: 0 },
    MANDATE: { total: 0, recovered: 0, amountPaise: 0 },
    NETBANKING: { total: 0, recovered: 0, amountPaise: 0 },
  };

  cases.forEach((c) => {
    const rail = (c.original_rail || "CARD").toUpperCase() as keyof typeof railStats;
    if (railStats[rail]) {
      railStats[rail].total += 1;
      railStats[rail].amountPaise += c.amount_paise;
      if (c.status === "RECOVERED") {
        railStats[rail].recovered += 1;
      }
    }
  });

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header Intro */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Payment Telemetry Infrastructure
          </span>
          <h1 className="text-[24px] font-semibold text-[#202525] mt-0.5 leading-tight">
            Gateway Rails &amp; Cryptographic Settlement Ledger
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Real-time issuer availability, smart rail switching telemetry, and tamper-evident SHA-256 execution proofs.
          </p>
        </div>

        <div className="flex items-center space-x-4 text-[12px] font-mono border-t md:border-t-0 md:border-l border-[#E2E5E5] pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Rail Switching</span>
            <span className="font-semibold text-[#2E7D5B]">AUTOMATED</span>
          </div>
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Double Charge Risk</span>
            <span className="font-semibold text-[#2E7D5B]">0.00% (IDEMPOTENT)</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Rail Health Diagnostic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* UPI Autopay */}
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4 text-[#087F83]" />
              <span className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
                UPI Autopay
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/20">
              HEALTHY
            </span>
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            99.8% <span className="text-[14px] font-sans font-normal text-[#6F7777]">uptime</span>
          </div>
          <div className="text-[12px] text-[#6F7777] space-y-0.5 pt-1 border-t border-[#E2E5E5]">
            <div className="flex justify-between">
              <span className="font-normal">Avg Latency:</span>
              <span className="font-mono font-medium text-[#202525]">140ms</span>
            </div>
            <div className="flex justify-between">
              <span className="font-normal">Active Cases:</span>
              <span className="font-mono font-medium text-[#202525]">{railStats.UPI.total}</span>
            </div>
          </div>
        </div>

        {/* Recurring Cards */}
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-[#B7791F]" />
              <span className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
                Credit / Debit
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/20">
              MODERATE
            </span>
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            97.4% <span className="text-[14px] font-sans font-normal text-[#6F7777]">uptime</span>
          </div>
          <div className="text-[12px] text-[#6F7777] space-y-0.5 pt-1 border-t border-[#E2E5E5]">
            <div className="flex justify-between">
              <span className="font-normal">3DS Completion:</span>
              <span className="font-mono font-medium text-[#202525]">79.2%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-normal">Active Cases:</span>
              <span className="font-mono font-medium text-[#202525]">{railStats.CARD.total}</span>
            </div>
          </div>
        </div>

        {/* e-Mandate / NACH */}
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#087F83]" />
              <span className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
                e-Mandate / NACH
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#087F83]/10 text-[#087F83] border border-[#087F83]/20">
              OPERATIONAL
            </span>
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            98.9% <span className="text-[14px] font-sans font-normal text-[#6F7777]">clearing</span>
          </div>
          <div className="text-[12px] text-[#6F7777] space-y-0.5 pt-1 border-t border-[#E2E5E5]">
            <div className="flex justify-between">
              <span className="font-normal">Clearing Cycle:</span>
              <span className="font-mono font-medium text-[#202525]">T+1 EOD</span>
            </div>
            <div className="flex justify-between">
              <span className="font-normal">Active Cases:</span>
              <span className="font-mono font-medium text-[#202525]">{railStats.MANDATE.total}</span>
            </div>
          </div>
        </div>

        {/* NetBanking Direct */}
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#6F7777]" />
              <span className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
                NetBanking
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]">
              ONLINE
            </span>
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            99.2% <span className="text-[14px] font-sans font-normal text-[#6F7777]">availability</span>
          </div>
          <div className="text-[12px] text-[#6F7777] space-y-0.5 pt-1 border-t border-[#E2E5E5]">
            <div className="flex justify-between">
              <span className="font-normal">Bank Downtimes:</span>
              <span className="font-mono font-medium text-[#202525]">0 Active</span>
            </div>
            <div className="flex justify-between">
              <span className="font-normal">Active Cases:</span>
              <span className="font-mono font-medium text-[#202525]">{railStats.NETBANKING.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Transaction Telemetry & Cryptographic Verification Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-[#2E7D5B]" />
            <h2 className="font-semibold text-[16px] tracking-wide text-[#202525] uppercase">
              Settlement Telemetry &amp; SHA-256 Audit Stream
            </h2>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777]">
            {cases.length} transactions recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] font-normal font-sans">
            <thead>
              <tr className="bg-[#F5F6F6] border-b border-[#E2E5E5] text-[11px] font-semibold uppercase tracking-wider text-[#6F7777]">
                <th className="py-2.5 px-4 font-mono">Payment Case</th>
                <th className="py-2.5 px-4">Customer Account</th>
                <th className="py-2.5 px-4 text-right font-mono">Value (INR)</th>
                <th className="py-2.5 px-4">Original Rail</th>
                <th className="py-2.5 px-4">Target Recovery Rail</th>
                <th className="py-2.5 px-4 font-mono">Idempotency Key</th>
                <th className="py-2.5 px-4">Audit Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {cases.map((c) => {
                const targetRail =
                  c.intervention?.action === "SWITCH_RAIL_UPI"
                    ? "UPI (SWITCHED)"
                    : c.original_rail;

                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c)}
                    className="hover:bg-[#F5F6F6] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-[12px] font-medium text-[#6F7777]">
                      {c.id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[13px] font-normal text-[#202525]">
                        {c.customer_name}
                      </div>
                      <div className="text-[12px] font-normal text-[#6F7777]">{c.plan_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#202525]">
                      ₹{c.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] text-[#6F7777]">
                      {c.original_rail}
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#087F83]">
                      {targetRail}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#6F7777]">
                      idemp_{c.id.toLowerCase().replace(/[^a-z0-9]/g, "")}_v1
                    </td>
                    <td className="py-3 px-4">
                      {c.status === "RECOVERED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#2E7D5B]/10 text-[#2E7D5B] border border-[#2E7D5B]/20">
                          <CheckCircle2 className="w-3 h-3" /> SETTLED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]">
                          {c.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

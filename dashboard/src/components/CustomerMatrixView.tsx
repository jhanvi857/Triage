"use client";

import React from "react";
import { Users, Building, Calendar, DollarSign, ArrowRight, ShieldAlert } from "lucide-react";
import { TriageCase } from "../lib/types";

interface CustomerMatrixViewProps {
  cases: TriageCase[];
  onSelectCase: (c: TriageCase) => void;
}

export const CustomerMatrixView: React.FC<CustomerMatrixViewProps> = ({ cases, onSelectCase }) => {
  const highValueCount = cases.filter((c) => c.amount_inr >= 10000).length;
  const avgPayday =
    cases.reduce((sum, c) => sum + (c.payday_proximity_days || 7), 0) / (cases.length || 1);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header Info */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Subscriber Retention Operations
          </span>
          <h1 className="text-[24px] font-semibold text-[#202525] mt-0.5 leading-tight">
            Customer Impact &amp; Concession Matrix
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Proactive dunning orchestration, salary-window alignment, and bounded incentive tracking.
          </p>
        </div>

        <div className="flex items-center space-x-5 text-[12px] font-mono border-t md:border-t-0 md:border-l border-[#E2E5E5] pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Enterprise Risk</span>
            <span className="font-semibold text-[#B7791F]">{highValueCount} Accounts (&ge;₹10k)</span>
          </div>
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Concession Cap</span>
            <span className="font-semibold text-[#202525]">₹500 / Case</span>
          </div>
        </div>
      </div>

      {/* 2. Customer Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#6F7777] block">
            Impacted Accounts
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            {cases.length}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Experiencing billing friction
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#B7791F] block">
            High-Value Accounts
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#B7791F] leading-tight">
            {highValueCount}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Senior Retention Review
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#6F7777] block">
            Avg Payday Proximity
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#087F83] leading-tight">
            {avgPayday.toFixed(1)} <span className="text-[14px] font-normal text-[#6F7777]">days</span>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Salary alignment window
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <span className="text-[14px] font-semibold text-[#2E7D5B] block">
            Concession Budget
          </span>
          <div className="text-[26px] font-mono font-semibold text-[#2E7D5B] leading-tight">
            ₹9,480 <span className="text-[14px] font-normal text-[#6F7777]">/ ₹10k</span>
          </div>
          <span className="text-[12px] text-[#2E7D5B] block font-medium">
            94.8% capacity remaining
          </span>
        </div>
      </div>

      {/* 3. Customer Directory Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#087F83]" />
            <h2 className="font-semibold text-[16px] tracking-wide text-[#202525] uppercase">
              Subscriber Accounts Billing Directory
            </h2>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777]">{cases.length} subscribers</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] font-normal">
            <thead>
              <tr className="bg-[#F5F6F6] border-b border-[#E2E5E5] text-[11px] font-semibold tracking-wider text-[#6F7777] uppercase">
                <th className="py-2.5 px-4">Subscriber Company</th>
                <th className="py-2.5 px-4">Subscription Plan</th>
                <th className="py-2.5 px-4 text-right font-mono">At-Risk Value</th>
                <th className="py-2.5 px-4">Failure Reason</th>
                <th className="py-2.5 px-4 text-center">Payday Timing</th>
                <th className="py-2.5 px-4">ML Intervention</th>
                <th className="py-2.5 px-4">State</th>
                <th className="py-2.5 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {cases.map((c) => {
                const isHighValue = c.amount_inr >= 10000;
                return (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCase(c)}
                    className="hover:bg-[#F5F6F6] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-normal text-[#202525]">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{c.customer_name}</span>
                        {isHighValue && (
                          <span className="text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded bg-[#B7791F]/15 text-[#B7791F] border border-[#B7791F]/30">
                            ENTERPRISE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#6F7777]">
                      {c.plan_name}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-[#202525]">
                      ₹{c.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 font-mono text-[12px] font-normal text-[#6F7777]">
                      {c.diagnosis?.root_cause || c.error_code}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[12px] text-[#6F7777]">
                      {c.payday_proximity_days !== undefined
                        ? c.payday_proximity_days <= 1
                          ? "Tomorrow (1d)"
                          : `${c.payday_proximity_days} days`
                        : "7 days"}
                    </td>
                    <td className="py-3 px-4 text-[#202525]">
                      {c.intervention?.action || "Evaluating..."}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="text-[12px] font-medium text-[#087F83] hover:text-[#06686B] flex items-center gap-0.5 justify-end">
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
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

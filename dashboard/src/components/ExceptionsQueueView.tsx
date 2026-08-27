"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, UserCheck, AlertOctagon, CheckCircle2, RotateCcw } from "lucide-react";
import { TriageCase } from "../lib/types";

interface ExceptionsQueueViewProps {
  cases: TriageCase[];
  onSelectCase: (c: TriageCase) => void;
  onResolve: (id: string, resolution: "RECOVERED" | "LOST" | "ESCALATED", notes: string) => Promise<void>;
  processingId: string | null;
}

export const ExceptionsQueueView: React.FC<ExceptionsQueueViewProps> = ({
  cases,
  onSelectCase,
  onResolve,
  processingId,
}) => {
  const exceptionCases = cases.filter(
    (c) => c.status === "LOST" || c.status === "ESCALATED"
  );

  const maxAttemptsCount = exceptionCases.filter((c) => c.attempts_made >= 3).length;
  const highValueCount = exceptionCases.filter((c) => c.amount_inr >= 10000).length;
  const fraudCount = exceptionCases.filter(
    (c) => c.diagnosis?.root_cause === "FRAUD_SUSPECTED" || c.error_code.includes("FRAUD")
  ).length;

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header Alert Banner */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#B7791F] bg-[#B7791F]/10 px-2 py-0.5 rounded border border-[#B7791F]/20">
              HUMAN DESK &bull; STOPPING RULES
            </span>
          </div>
          <h1 className="text-[24px] font-semibold text-[#202525] mt-1 leading-tight">
            Exceptions &amp; Policy Gated Review Queue
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Deterministic code stops automated retries to protect customer trust, prevent regulatory non-compliance, and handle enterprise escalations.
          </p>
        </div>

        <div className="flex items-center space-x-4 font-mono text-[12px] border-t md:border-t-0 md:border-l border-[#E2E5E5] pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Active Exceptions</span>
            <span className="font-semibold text-[#B7791F] text-[14px]">{exceptionCases.length} Cases</span>
          </div>
          <div>
            <span className="text-[12px] text-[#6F7777] block font-sans font-normal">Policy Rule</span>
            <span className="font-semibold text-[#202525] text-[14px]">Deterministic Veto</span>
          </div>
        </div>
      </div>

      {/* 2. 4 Policy Guardrail Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#C94A4A]">
              Max Attempts (3/3)
            </span>
            <AlertOctagon className="w-4 h-4 text-[#C94A4A]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#C94A4A] leading-tight">
            {maxAttemptsCount}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Ceased dunning to avoid friction
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#B7791F]">
              High-Value (&ge;₹10k)
            </span>
            <UserCheck className="w-4 h-4 text-[#B7791F]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#B7791F] leading-tight">
            {highValueCount}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Assigned to Retention Specialist
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#087F83]">
              Fraud &amp; Velocity
            </span>
            <ShieldAlert className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#087F83] leading-tight">
            {fraudCount}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Zero automated retries permitted
          </span>
        </div>

        <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6F7777]">
              Unmapped Errors
            </span>
            <AlertTriangle className="w-4 h-4 text-[#6F7777]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] leading-tight">
            {exceptionCases.filter((c) => c.diagnosis?.root_cause === "UNKNOWN_ERROR").length}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Requires manual telemetry triage
          </span>
        </div>
      </div>

      {/* 3. Exceptions Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#B7791F]" />
            <h2 className="font-semibold text-[16px] tracking-wide text-[#202525] uppercase">
              Exceptions Requiring Manual Intervention / Verification
            </h2>
          </div>
          <span className="text-[12px] font-normal text-[#6F7777]">
            {exceptionCases.length} exceptions listed
          </span>
        </div>

        {exceptionCases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13px] font-normal font-sans">
              <thead>
                <tr className="bg-[#F5F6F6] border-b border-[#E2E5E5] text-[11px] font-semibold uppercase tracking-wider text-[#6F7777]">
                  <th className="py-2.5 px-4 font-mono">Case ID</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4 text-right font-mono">Value (INR)</th>
                  <th className="py-2.5 px-4">Root Cause</th>
                  <th className="py-2.5 px-4">Stopping Reason &amp; Policy Rule</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Human Override Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E5]">
                {exceptionCases.map((c) => {
                  const isActing = processingId === c.id;
                  const stoppingReason =
                    c.intervention?.stopping_reason ||
                    (c.amount_inr >= 10000
                      ? "High-Value Transaction (>= ₹10,000)"
                      : c.attempts_made >= 3
                      ? "Max Attempts Limit (3/3) Exhausted"
                      : c.diagnosis?.technical_reason || "Escalated for Manual Review");

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
                        ₹{c.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-4 font-mono text-[12px] text-[#B7791F] font-semibold">
                        {c.diagnosis?.root_cause || c.error_code}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[13px] font-normal text-[#202525] block">
                          {stoppingReason}
                        </span>
                        <span className="text-[12px] text-[#6F7777] font-mono">
                          Attempts: {c.attempts_made} of {c.max_attempts}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#B7791F]/10 text-[#B7791F] border border-[#B7791F]/20">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => onResolve(c.id, "RECOVERED", "Manually resolved via offline payment / direct bank transfer")}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded bg-[#2E7D5B]/10 hover:bg-[#2E7D5B]/20 border border-[#2E7D5B]/20 text-[#2E7D5B] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Mark Settled
                          </button>
                          <button
                            onClick={() => onResolve(c.id, "LOST", "Manually verified as unrecoverable churn")}
                            disabled={isActing}
                            className="px-2.5 py-1 rounded bg-[#F5F6F6] hover:bg-[#E2E5E5] border border-[#E2E5E5] text-[#6F7777] text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Mark Lost
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-[#6F7777] space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#2E7D5B] mx-auto" />
            <h3 className="font-semibold text-[16px] uppercase text-[#202525]">
              No Unresolved Policy Exceptions
            </h3>
            <p className="text-[14px] font-normal text-[#6F7777]">
              All active payment cases are progressing normally through automated triage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

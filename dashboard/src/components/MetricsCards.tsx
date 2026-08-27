"use client";

import React from "react";
import { AuditEntry } from "../lib/types";

interface MetricsCardsProps {
  entries: AuditEntry[];
  totalBlocks: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ entries, totalBlocks }) => {
  // Aggregate stats
  let totalVolumeINR = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  entries.forEach((e) => {
    if (e.action === "PAYMENT_CAPTURED" || (e.gate_decision === "APPROVED" && e.status === "PAID")) {
      totalVolumeINR += e.amount_paise / 100;
      approvedCount++;
    } else if (e.gate_decision === "PENDING_APPROVAL" || e.status === "PENDING_APPROVAL") {
      pendingCount++;
    } else if (e.gate_decision === "REJECTED" || e.status === "REJECTED") {
      rejectedCount++;
    }
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Metric 1: Total Volume Transacted */}
      <div id="card-metric-volume" className="p-4 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Volume Authorized</span>
          <span className="text-[10px] font-mono text-zinc-500">INR</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono tracking-tight">
          ₹{totalVolumeINR.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Settled on Razorpay</span>
        </div>
      </div>

      {/* Metric 2: Autonomous Approvals */}
      <div id="card-metric-approved" className="p-4 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Autonomous Passes</span>
          <span className="text-[10px] font-mono text-zinc-500">Gate</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono tracking-tight">
          {approvedCount}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">
          Within spend cap &amp; &lt; ₹5k threshold
        </div>
      </div>

      {/* Metric 3: Gated Pending Approvals */}
      <div id="card-metric-pending" className="p-4 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">High-Value Gated</span>
          <span className="text-[10px] font-mono text-amber-400">Review</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono tracking-tight">
          {pendingCount}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">
          Single transaction &ge; ₹5,000 threshold
        </div>
      </div>

      {/* Metric 4: Over-Budget Blocks */}
      <div id="card-metric-rejected" className="p-4 rounded-xl bg-surface border border-surface-border">
        <div className="flex items-center justify-between text-zinc-400 mb-1">
          <span className="text-[10px] font-mono uppercase tracking-wider">Budget Intercepts</span>
          <span className="text-[10px] font-mono text-zinc-500">Blocked</span>
        </div>
        <div className="text-2xl font-bold text-white font-mono tracking-tight">
          {rejectedCount}
        </div>
        <div className="mt-2 text-[11px] text-zinc-400">
          Hard spend-cap enforcement
        </div>
      </div>
    </div>
  );
};

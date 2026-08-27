"use client";

import React, { useState } from "react";
import { RefreshCw, Check } from "lucide-react";
import { BudgetState } from "../lib/types";

interface BudgetVisualizerProps {
  budget: BudgetState | null;
  selectedAgent: string;
  onSelectAgent: (agentId: string) => void;
  onResetBudget: (agentId: string) => void;
}

const DEMO_AGENTS = [
  { id: "agent_compute_01", label: "Compute (S1)", role: "Happy Path" },
  { id: "agent_adaptive_02", label: "Adaptive (S2)", role: "Over-Budget" },
  { id: "agent_compliance_03", label: "Compliance (S3)", role: "Gated > ₹5k" },
  { id: "agent_network_04", label: "Network (S4)", role: "Idempotency" },
];

export const BudgetVisualizer: React.FC<BudgetVisualizerProps> = ({
  budget,
  selectedAgent,
  onSelectAgent,
  onResetBudget,
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const capacity = budget?.capacity_inr || 10000;
  const remaining = budget?.remaining_inr ?? 10000;
  const spent = budget?.spent_inr ?? 0;

  const spentPercent = Math.min(100, Math.max(0, (spent / capacity) * 100));

  const handleReset = async () => {
    setIsResetting(true);
    await onResetBudget(selectedAgent);
    setIsResetting(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 2000);
  };

  return (
    <div className="p-5 rounded-xl bg-surface border border-surface-border flex flex-col justify-between">
      <div>
        {/* Header with Title & Refill Action */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-surface-border">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Spend Token Bucket</h2>
            <p className="text-[11px] text-zinc-400">Vexor-derived atomic reserve &amp; hard spend-cap</p>
          </div>

          <button
            id="btn-reset-agent-budget"
            onClick={handleReset}
            disabled={isResetting}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {resetSuccess ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px]">Refilled</span>
              </>
            ) : (
              <>
                <RefreshCw className={`w-3 h-3 text-zinc-400 ${isResetting ? "animate-spin" : ""}`} />
                <span className="text-[11px]">Reset (₹10k)</span>
              </>
            )}
          </button>
        </div>

        {/* Agent Segmented Control */}
        <div className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-zinc-900/80 p-1 rounded-lg border border-surface-border">
            {DEMO_AGENTS.map((a) => (
              <button
                key={a.id}
                id={`btn-select-agent-${a.id}`}
                onClick={() => onSelectAgent(a.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium text-left transition-all ${
                  selectedAgent === a.id
                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent"
                }`}
              >
                <div className="font-semibold truncate text-[11px]">{a.label}</div>
                <div className="text-[9px] text-zinc-500 font-mono">{a.role}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 bg-zinc-900/60 p-3 rounded-lg border border-surface-border mb-4">
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500">Remaining</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">
              ₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500">Spent</span>
            <div className="text-lg font-bold text-zinc-300 font-mono mt-0.5">
              ₹{spent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-zinc-500">Cap Allowance</span>
            <div className="text-lg font-bold text-zinc-400 font-mono mt-0.5">
              ₹{capacity.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Minimal Precision Meter */}
        <div>
          <div className="flex justify-between text-[11px] text-zinc-400 mb-1.5 font-mono">
            <span>Used: {spentPercent.toFixed(1)}%</span>
            <span>Limit: ₹{capacity.toLocaleString("en-IN")}</span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              style={{ width: `${spentPercent}%` }}
              className="h-full bg-zinc-300 transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Footer policy rule notes */}
      <div className="mt-4 pt-3 border-t border-surface-border text-[11px] text-zinc-400 flex items-center justify-between font-mono">
        <span>Autonomous Threshold: &lt; ₹5,000</span>
        <span>Hard Spend Cap: ₹10,000</span>
      </div>
    </div>
  );
};

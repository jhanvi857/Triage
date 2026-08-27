"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, Check, Wallet } from "lucide-react";
import { BudgetState } from "../lib/types";

interface AgentDef {
  id: string;
  name: string;
  role: string;
  desc: string;
}

const AGENT_LIST: AgentDef[] = [
  { id: "agent_compute_01", name: "Compute Agent", role: "S1: Happy Path", desc: "Model Training Bot" },
  { id: "agent_adaptive_02", name: "Adaptive Agent", role: "S2: Over-Budget", desc: "Downsizing Recovery" },
  { id: "agent_compliance_03", name: "Compliance Agent", role: "S3: Gated (>₹5k)", desc: "Enterprise Licenser" },
  { id: "agent_network_04", name: "Network Agent", role: "S4: Idempotency", desc: "Flaky Retry Handler" },
];

interface RadialBudgetGaugesProps {
  budgets: Record<string, BudgetState>;
  onResetBudget: (agentId: string) => Promise<void>;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
}

export const RadialBudgetGauges: React.FC<RadialBudgetGaugesProps> = ({
  budgets,
  onResetBudget,
  selectedAgentId,
  onSelectAgent,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [resettingId, setResettingId] = useState<string | null>(null);

  const handleReset = async (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setResettingId(agentId);
    try {
      await onResetBudget(agentId);
    } finally {
      setTimeout(() => setResettingId(null), 1000);
    }
  };

  // SVG parameters
  const size = 96;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col h-full bg-[#131720] border border-[#1E2638] rounded-lg p-4 space-y-3.5">
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1E2638]">
        <div className="flex items-center space-x-2">
          <Wallet className="w-4 h-4 text-[#4C8DFF]" />
          <div>
            <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#E4E7EB]">
              Agent Spend Buckets
            </h2>
            <p className="text-[10px] text-zinc-400">Token-bucket capacity bounds</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-[#0B0E14] border border-[#1E2638]">
          ₹10k CAP
        </span>
      </div>

      {/* Agent Radial Cards List */}
      <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
        {AGENT_LIST.map((agent) => {
          const b = budgets[agent.id];
          const capacity = b?.capacity_inr || 10000;
          const remaining = b?.remaining_inr ?? 10000;
          const spent = b?.spent_inr ?? 0;
          const spentRatio = Math.min(1, Math.max(0, spent / capacity));
          const spentPercent = Math.round(spentRatio * 100);
          const isSelected = selectedAgentId === agent.id;
          const isResetting = resettingId === agent.id;

          // Stroke Dashoffset for Radial Fill (0 offset = 100% fill)
          const strokeOffset = circumference - spentRatio * circumference;

          // State color mapping
          let ringColor = "#34D399"; // Emerald (< 50%)
          if (spentRatio >= 0.75) ringColor = "#F04F4F"; // Rose (exhausted)
          else if (spentRatio >= 0.5) ringColor = "#F5A623"; // Amber (high)

          return (
            <div
              key={agent.id}
              id={`agent-gauge-${agent.id}`}
              onClick={() => onSelectAgent(agent.id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? "bg-[#181D29] border-[#4C8DFF]/60 shadow-xs"
                  : "bg-[#0E121B] border-[#1E2638] hover:border-zinc-600"
              }`}
            >
              {/* Top: Agent Info & Reset Button */}
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-[#E4E7EB]">{agent.name}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4C8DFF] animate-pulse" />
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">{agent.role}</div>
                </div>

                <button
                  id={`btn-reset-${agent.id}`}
                  onClick={(e) => handleReset(agent.id, e)}
                  disabled={isResetting}
                  title="Reset spend budget tokens"
                  className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-[#131720] border border-[#1E2638] hover:border-zinc-500 text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isResetting ? "animate-spin text-[#4C8DFF]" : ""}`} />
                  <span>Reset</span>
                </button>
              </div>

              {/* Middle: Animated Radial Fill Gauge + Numbers */}
              <div className="flex items-center space-x-3.5">
                {/* SVG Radial Gauge */}
                <div className="relative w-18 h-18 shrink-0 flex items-center justify-center">
                  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
                    {/* Background Track */}
                    <circle
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke="#1E2638"
                      strokeWidth={strokeWidth}
                    />
                    {/* Animated Fill Circle with Spring Physics */}
                    {prefersReducedMotion ? (
                      <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                      />
                    ) : (
                      <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={ringColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: strokeOffset }}
                        transition={{
                          type: "spring" as const,
                          stiffness: 70,
                          damping: 14,
                        }}
                        strokeLinecap="round"
                      />
                    )}
                  </svg>

                  {/* Percentage in Radial Center */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-mono font-black text-[#E4E7EB]">
                      {spentPercent}%
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase -mt-0.5">used</span>
                  </div>
                </div>

                {/* Balance Numbers in JetBrains Mono */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">Remaining Allowance</div>
                  <div className="text-base font-black font-mono text-[#E4E7EB] tracking-tight">
                    ₹{remaining.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>

                  <div className="mt-1 pt-1 border-t border-[#1E2638] flex items-center justify-between text-[10px] font-mono text-zinc-400">
                    <span>Spent: <strong className="text-zinc-300 font-semibold">₹{spent.toFixed(0)}</strong></span>
                    <span>Cap: <strong className="text-zinc-300 font-semibold">₹{capacity.toFixed(0)}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Gating Rule */}
      <div className="pt-2.5 border-t border-[#1E2638] text-[10px] font-mono text-zinc-400 flex items-center justify-between">
        <span>Gating: &lt; ₹5,000 Auto</span>
        <span>&ge; ₹5,000 Manual</span>
      </div>
    </div>
  );
};

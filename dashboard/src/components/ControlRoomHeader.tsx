"use client";

import React, { useState } from "react";
import { Play, Loader2, RefreshCw, Layers, ShieldCheck, Activity } from "lucide-react";

interface ControlRoomHeaderProps {
  chainVerified: boolean;
  totalBlocks: number;
  isSseConnected: boolean;
  onRefresh: () => void;
  onOpenCatalog: () => void;
  onTriggerScenario: (scenarioNumber: number) => Promise<void>;
  runningScenarioId: number | null;
}

const SCENARIOS = [
  { id: 1, label: "01 Happy Path", desc: "₹3.6k GPU → Approved" },
  { id: 2, label: "02 Over-Budget", desc: "₹25k → Blocked → Downsize" },
  { id: 3, label: "03 Gated (>₹5k)", desc: "₹7.5k → Manual Review" },
  { id: 4, label: "04 Idempotency", desc: "Timeout → 0 Double Billing" },
];

export const ControlRoomHeader: React.FC<ControlRoomHeaderProps> = ({
  chainVerified,
  totalBlocks,
  isSseConnected,
  onRefresh,
  onOpenCatalog,
  onTriggerScenario,
  runningScenarioId,
}) => {
  return (
    <header className="border-b border-[#1E2638] bg-[#0B0E14] px-5 py-3 sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Brand + One-line Pitch */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-[#E4E7EB] text-[#0B0E14] font-mono font-black text-sm">
            L
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm tracking-wider text-[#E4E7EB]">LEDGER</span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#131720] text-zinc-400 border border-[#1E2638]">
                CONTROL ROOM
              </span>
              <div className="flex items-center space-x-1 text-[11px] font-mono text-zinc-400">
                <span className={`w-2 h-2 rounded-full ${isSseConnected ? "bg-[#34D399]" : "bg-[#F5A623]"}`} />
                <span className="text-[10px]">{isSseConnected ? "LIVE" : "SYNCING"}</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 tracking-tight">
              Autonomous payment triage, recovery &amp; spend-gating layer on Razorpay
            </p>
          </div>
        </div>

        {/* Center: Compact 1-Click Pitch Scenario Trigger Buttons */}
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1 hidden sm:inline">
            Trigger Scenarios:
          </span>
          {SCENARIOS.map((s) => {
            const isRunning = runningScenarioId === s.id;
            return (
              <button
                key={s.id}
                id={`btn-scenario-${s.id}`}
                disabled={runningScenarioId !== null}
                onClick={() => onTriggerScenario(s.id)}
                className={`group flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-mono transition-all border ${
                  isRunning
                    ? "bg-[#4C8DFF]/20 border-[#4C8DFF] text-[#4C8DFF]"
                    : "bg-[#131720] hover:bg-[#181D29] border-[#1E2638] hover:border-zinc-500 text-[#E4E7EB]"
                } disabled:opacity-50 cursor-pointer`}
              >
                {isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin text-[#4C8DFF]" />
                ) : (
                  <Play className="w-2.5 h-2.5 text-zinc-400 group-hover:text-white transition-colors" />
                )}
                <span className="font-semibold text-[11px]">{s.label}</span>
                <span className="text-[9px] text-zinc-500 hidden xl:inline">({s.desc})</span>
              </button>
            );
          })}
        </div>

        {/* Right: Health Badge & Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <div
            id="badge-chain-integrity"
            className="flex items-center space-x-1 px-2 py-1 rounded bg-[#131720] border border-[#1E2638] text-[10px] font-mono text-zinc-300"
          >
            <ShieldCheck className={`w-3 h-3 ${chainVerified ? "text-[#34D399]" : "text-[#F04F4F]"}`} />
            <span>Chain: {chainVerified ? "Intact" : "Degraded"}</span>
            <span className="text-zinc-500">({totalBlocks})</span>
          </div>

          <button
            id="btn-open-catalog"
            onClick={onOpenCatalog}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-[#131720] border border-[#1E2638] hover:border-zinc-500 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
          >
            <Layers className="w-3 h-3" />
            <span className="text-[11px]">Catalog</span>
          </button>

          <button
            id="btn-refresh-dashboard"
            onClick={onRefresh}
            title="Refresh All State"
            className="p-1.5 rounded bg-[#131720] border border-[#1E2638] hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};

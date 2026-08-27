"use client";

import React from "react";
import { ShieldCheck, Key, Terminal, RefreshCw, Layers } from "lucide-react";

interface HeaderProps {
  chainVerified: boolean;
  totalBlocks: number;
  onRefresh: () => void;
  onOpenRunner: () => void;
  onOpenCatalog: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  chainVerified,
  totalBlocks,
  onRefresh,
  onOpenRunner,
  onOpenCatalog,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#09090B]/95 backdrop-blur-sm px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Brand / Title */}
        <div className="flex items-center space-x-3.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 font-mono font-bold text-sm">
            L
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">LEDGER</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                GATEWAY v1.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Autonomous Agent Payment Gating Layer &bull; Razorpay Sandbox
            </p>
          </div>
        </div>

        {/* Right: Status Badges & Minimalist Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Cryptographic Hash-Chain Integrity Status */}
          <div
            id="badge-chain-integrity"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${chainVerified ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-[11px] font-mono">Chain: {chainVerified ? "Verified" : "Degraded"}</span>
            <span className="text-zinc-500 font-mono text-[10px]">({totalBlocks} evt)</span>
          </div>

          {/* Catalog Button */}
          <button
            id="btn-view-catalog"
            onClick={onOpenCatalog}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700/80 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Catalog</span>
          </button>

          {/* Clean High-Contrast White Action Button for Demo */}
          <button
            id="btn-open-scenario-runner"
            onClick={onOpenRunner}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-md bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Run Pitch Demo</span>
          </button>

          {/* Refresh Button */}
          <button
            id="btn-refresh-dashboard"
            onClick={onRefresh}
            title="Refresh All Data"
            className="p-1.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

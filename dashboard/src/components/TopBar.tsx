"use client";

import React, { useState } from "react";
import { Plus, RotateCcw, BarChart3, FastForward, Search } from "lucide-react";
import { NavTab } from "./Sidebar";

interface TopBarProps {
  activeTab: NavTab;
  isSseConnected: boolean;
  onOpenBatchModal: () => void;
  onOpenIngestModal: () => void;
  onAdvanceAll: () => Promise<void>;
  onResetBoard: () => Promise<void>;
  isBatchRunning: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  isSseConnected,
  onOpenBatchModal,
  onOpenIngestModal,
  onAdvanceAll,
  onResetBoard,
  isBatchRunning,
  searchQuery = "",
  onSearchChange,
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
    if (onSearchChange) {
      onSearchChange(e.target.value);
    }
  };

  return (
    <header className="h-14 border-b border-[#E2E5E5] bg-[#FFFFFF] px-6 flex items-center justify-between sticky top-0 z-20 font-sans">
      {/* Left: Brand/Section identifier */}
      <div className="flex items-center space-x-3">
        <h1 className="font-semibold text-[24px] tracking-tight text-[#202525] uppercase leading-none">
          TRIAGE
        </h1>
        <span className="text-[#6F7777] text-[12px] font-normal hidden sm:inline border-l border-[#E2E5E5] pl-3">
          Revenue Recovery Dispatch
        </span>
      </div>

      {/* Middle: Clean Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden md:block">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#6F7777] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search cases, customers, error codes..."
            value={localSearch}
            onChange={handleSearch}
            className="w-full bg-[#F5F6F6] border border-[#E2E5E5] rounded-md pl-9 pr-3 py-1.5 text-[13px] font-normal text-[#202525] placeholder:text-[#6F7777] placeholder:text-[13px] focus:outline-hidden focus:border-[#087F83] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right: Operational Status & Action Controls */}
      <div className="flex items-center space-x-3">
        {/* Live Operational Indicator */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#2E7D5B]/10 text-[#2E7D5B] text-[11px] font-semibold border border-[#2E7D5B]/20">
          <span className={`w-1.5 h-1.5 rounded-full ${isSseConnected ? "bg-[#2E7D5B] animate-pulse" : "bg-[#B7791F]"}`} />
          <span className="font-mono text-[11px] font-semibold tracking-wide">
            {isSseConnected ? "Operational" : "Reconnecting"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            id="btn-run-batch-harness"
            onClick={onOpenBatchModal}
            disabled={isBatchRunning}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium tracking-wide transition-colors cursor-pointer disabled:opacity-50"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isBatchRunning ? "Simulating..." : "Evaluation"}</span>
          </button>

          <button
            id="btn-ingest-failure-case"
            onClick={onOpenIngestModal}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F5F6F6] border border-[#E2E5E5] text-[#202525] text-[12px] font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#087F83]" />
            <span className="hidden sm:inline">Ingest</span>
          </button>

          <button
            id="btn-advance-all-topbar"
            onClick={onAdvanceAll}
            title="Advance All Active Cases"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F5F6F6] border border-[#E2E5E5] text-[#202525] text-[12px] font-medium transition-colors cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5 text-[#6F7777]" />
            <span className="hidden sm:inline">Advance All</span>
          </button>

          <button
            id="btn-reset-triage-board"
            onClick={onResetBoard}
            title="Reset Board to Default State"
            className="p-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F5F6F6] border border-[#E2E5E5] text-[#6F7777] hover:text-[#202525] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};

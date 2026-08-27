"use client";

import React, { useState } from "react";
import { RotateCcw, FastForward, Plus, CheckCircle2, Clock, Sparkles, Filter } from "lucide-react";
import { TriageCase } from "../lib/types";
import { RecoveryQueueTable } from "./RecoveryQueueTable";

interface RecoveryPipelineViewProps {
  cases: TriageCase[];
  onSelectCase: (c: TriageCase) => void;
  onAdvanceCase: (id: string) => Promise<void>;
  onAdvanceAll: () => Promise<void>;
  onOpenIngestModal: () => void;
  processingId: string | null;
}

type StageFilter = "ALL" | "NEW" | "DIAGNOSED" | "INTERVENING" | "RECOVERED";

export const RecoveryPipelineView: React.FC<RecoveryPipelineViewProps> = ({
  cases,
  onSelectCase,
  onAdvanceCase,
  onAdvanceAll,
  onOpenIngestModal,
  processingId,
}) => {
  const [filter, setFilter] = useState<StageFilter>("ALL");

  const counts = {
    ALL: cases.length,
    NEW: cases.filter((c) => c.status === "NEW").length,
    DIAGNOSED: cases.filter((c) => c.status === "DIAGNOSED").length,
    INTERVENING: cases.filter((c) => c.status === "INTERVENING").length,
    RECOVERED: cases.filter((c) => c.status === "RECOVERED").length,
  };

  const filteredCases =
    filter === "ALL" ? cases : cases.filter((c) => c.status === filter);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header with Direct Pipeline Actions */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[12px] font-normal text-[#087F83] block">
            Real-Time Operations Pipeline
          </span>
          <h1 className="text-[24px] font-semibold text-[#202525] mt-0.5 leading-tight">
            Autonomous Revenue Recovery Queue
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            End-to-end payment decline pipeline: Structured Diagnosis &rarr; Random Forest ML Ranking &rarr; Policy Gating &rarr; Settle.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onAdvanceAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium tracking-wide transition-colors cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Advance All Cases</span>
          </button>

          <button
            onClick={onOpenIngestModal}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#FFFFFF] hover:bg-[#F5F6F6] border border-[#E2E5E5] text-[#202525] text-[12px] font-medium tracking-wide transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#087F83]" />
            <span>+ Ingest Decline</span>
          </button>
        </div>
      </div>

      {/* 2. Pipeline Stage Summary Cards / Clickable Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* NEW */}
        <div
          onClick={() => setFilter(filter === "NEW" ? "ALL" : "NEW")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            filter === "NEW"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6F7777]">
              1. New Declines
            </span>
            <span className="w-2 h-2 rounded-full bg-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] mt-1 leading-tight">
            {counts.NEW}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Awaiting diagnosis
          </span>
        </div>

        {/* DIAGNOSED */}
        <div
          onClick={() => setFilter(filter === "DIAGNOSED" ? "ALL" : "DIAGNOSED")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            filter === "DIAGNOSED"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6F7777]">
              2. Diagnosed
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] mt-1 leading-tight">
            {counts.DIAGNOSED}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            ML ranked &amp; ready
          </span>
        </div>

        {/* INTERVENING */}
        <div
          onClick={() => setFilter(filter === "INTERVENING" ? "ALL" : "INTERVENING")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            filter === "INTERVENING"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#6F7777]">
              3. Intervening
            </span>
            <Clock className="w-3.5 h-3.5 text-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#202525] mt-1 leading-tight">
            {counts.INTERVENING}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Smart retries / Active
          </span>
        </div>

        {/* RECOVERED */}
        <div
          onClick={() => setFilter(filter === "RECOVERED" ? "ALL" : "RECOVERED")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            filter === "RECOVERED"
              ? "bg-[#2E7D5B]/10 border-[#2E7D5B]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#2E7D5B]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-[#2E7D5B]">
              4. Recovered
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
          </div>
          <div className="text-[26px] font-mono font-semibold text-[#2E7D5B] mt-1 leading-tight">
            {counts.RECOVERED}
          </div>
          <span className="text-[12px] text-[#2E7D5B] block font-medium">
            Captured &amp; settled
          </span>
        </div>
      </div>

      {/* 3. Stage Filter Bar */}
      <div className="flex items-center space-x-2 text-[12px]">
        <Filter className="w-3.5 h-3.5 text-[#6F7777]" />
        <span className="text-[#6F7777] font-normal">Filter:</span>
        {(["ALL", "NEW", "DIAGNOSED", "INTERVENING", "RECOVERED"] as StageFilter[]).map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all border cursor-pointer ${
              filter === st
                ? "bg-[#087F83] text-white border-[#087F83]"
                : "bg-[#FFFFFF] text-[#6F7777] border-[#E2E5E5] hover:text-[#202525]"
            }`}
          >
            {st} ({counts[st]})
          </button>
        ))}
      </div>

      {/* 4. Full Recovery Queue Table */}
      <RecoveryQueueTable
        cases={filteredCases}
        onSelectCase={onSelectCase}
        onAdvanceCase={onAdvanceCase}
        processingId={processingId}
      />
    </div>
  );
};

"use client";

import React, { useState, useMemo } from "react";
import { FastForward, Plus, CheckCircle2, Clock, Sparkles, Filter, Radio, Layers } from "lucide-react";
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

type StageFilter = "ALL" | "NEW" | "DIAGNOSED" | "INTERVENING" | "PTP_COMMITTED" | "RECOVERED";

export const RecoveryPipelineView: React.FC<RecoveryPipelineViewProps> = ({
  cases,
  onSelectCase,
  onAdvanceCase,
  onAdvanceAll,
  onOpenIngestModal,
  processingId,
}) => {
  const [stageFilter, setStageFilter] = useState<StageFilter>("ALL");

  const counts = {
    ALL: cases.length,
    NEW: cases.filter((c) => c.status === "NEW").length,
    DIAGNOSED: cases.filter((c) => c.status === "DIAGNOSED").length,
    INTERVENING: cases.filter((c) => c.status === "INTERVENING").length,
    PTP_COMMITTED: cases.filter((c) => c.status === "PTP_COMMITTED" || c.status === "RETRY_SCHEDULED").length,
    RECOVERED: cases.filter((c) => c.status === "RECOVERED").length,
  };

  const filteredCases = useMemo(() => {
    if (stageFilter === "ALL") return cases;
    if (stageFilter === "PTP_COMMITTED") {
      return cases.filter((c) => c.status === "PTP_COMMITTED" || c.status === "RETRY_SCHEDULED");
    }
    return cases.filter((c) => c.status === stageFilter);
  }, [cases, stageFilter]);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header with Source Filter and Direct Pipeline Actions */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold text-[#087F83] uppercase tracking-wider">
              Real-Time Operations Pipeline
            </span>
          </div>
          <h1 className="text-[22px] font-semibold text-[#202525] leading-tight">
            Autonomous Revenue Recovery Queue
          </h1>
          <p className="text-[12px] font-normal text-[#6F7777] mt-0.5">
            Structured Diagnosis &rarr; Random Forest ML Ranking &rarr; Policy Authorization &rarr; Idempotent Settlement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EBF8F2] text-[#2F855A] border border-[#C6F6D5] text-[11px] font-mono font-bold uppercase">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Live Portfolio ({cases.length})</span>
          </div>

          <button
            onClick={onAdvanceAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium tracking-wide transition-colors cursor-pointer"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Advance Active</span>
          </button>
        </div>
      </div>

      {/* 2. Pipeline Stage Summary Cards / Clickable Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* NEW */}
        <div
          onClick={() => setStageFilter(stageFilter === "NEW" ? "ALL" : "NEW")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            stageFilter === "NEW"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#6F7777]">
              1. New Declines
            </span>
            <span className="w-2 h-2 rounded-full bg-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-bold text-[#202525] mt-1 leading-tight">
            {counts.NEW}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Awaiting diagnosis
          </span>
        </div>

        {/* DIAGNOSED */}
        <div
          onClick={() => setStageFilter(stageFilter === "DIAGNOSED" ? "ALL" : "DIAGNOSED")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            stageFilter === "DIAGNOSED"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#6F7777]">
              2. Diagnosed
            </span>
            <Sparkles className="w-3.5 h-3.5 text-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-bold text-[#202525] mt-1 leading-tight">
            {counts.DIAGNOSED}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            ML ranked &amp; ready
          </span>
        </div>

        {/* INTERVENING */}
        <div
          onClick={() => setStageFilter(stageFilter === "INTERVENING" ? "ALL" : "INTERVENING")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            stageFilter === "INTERVENING"
              ? "bg-[#087F83]/10 border-[#087F83]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#087F83]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#6F7777]">
              3. Intervening
            </span>
            <Clock className="w-3.5 h-3.5 text-[#087F83]" />
          </div>
          <div className="text-[26px] font-mono font-bold text-[#202525] mt-1 leading-tight">
            {counts.INTERVENING}
          </div>
          <span className="text-[12px] font-normal text-[#6F7777] block">
            Smart retries / Active
          </span>
        </div>

        {/* RECOVERED */}
        <div
          onClick={() => setStageFilter(stageFilter === "RECOVERED" ? "ALL" : "RECOVERED")}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            stageFilter === "RECOVERED"
              ? "bg-[#2E7D5B]/10 border-[#2E7D5B]"
              : "bg-[#FFFFFF] border-[#E2E5E5] hover:border-[#2E7D5B]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#2E7D5B]">
              4. Recovered
            </span>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2E7D5B]" />
          </div>
          <div className="text-[26px] font-mono font-bold text-[#2E7D5B] mt-1 leading-tight">
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
        <span className="text-[#6F7777] font-normal">Stage Filter:</span>
        {(["ALL", "NEW", "DIAGNOSED", "INTERVENING", "PTP_COMMITTED", "RECOVERED"] as StageFilter[]).map((st) => (
          <button
            key={st}
            onClick={() => setStageFilter(st)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all border cursor-pointer ${
              stageFilter === st
                ? "bg-[#087F83] text-white border-[#087F83]"
                : "bg-[#FFFFFF] text-[#6F7777] border-[#E2E5E5] hover:text-[#202525]"
            }`}
          >
            {st === "PTP_COMMITTED" ? "PTP / SCHEDULED" : st} ({counts[st]})
          </button>
        ))}
      </div>

      {/* 4. Full Recovery Queue Table */}
      <RecoveryQueueTable
        cases={filteredCases}
        onSelectCase={onSelectCase}
        onAdvanceCase={onAdvanceCase}
        processingId={processingId}
        title="Live Pipeline Queue"
        subtitle={`${filteredCases.length} active recovery workflow${filteredCases.length === 1 ? "" : "s"}`}
      />
    </div>
  );
};

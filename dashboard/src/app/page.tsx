"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar, NavTab } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { KpiMetrics } from "../components/KpiMetrics";
import { RecoveryQueueTable } from "../components/RecoveryQueueTable";
import { RevenueAtRiskBreakdown } from "../components/RevenueAtRiskBreakdown";
import { CaseDetailView } from "../components/CaseDetailView";
import { BatchEvaluationModal } from "../components/BatchEvaluationModal";
import { IngestFailureModal } from "../components/IngestFailureModal";
import { RecoveryPipelineView } from "../components/RecoveryPipelineView";
import { PaymentsRailView } from "../components/PaymentsRailView";
import { CustomerMatrixView } from "../components/CustomerMatrixView";
import { AnalyticsUpliftView } from "../components/AnalyticsUpliftView";
import { PortfolioAllocatorView } from "../components/PortfolioAllocatorView";
import { ExceptionsQueueView } from "../components/ExceptionsQueueView";
import {
  fetchCases,
  createCase,
  advanceCase,
  resolveCase,
  runBatchEvaluation,
  fetchSummaryStats,
  resetTriageBoard,
  getTriageSSEUrl,
} from "../lib/api";
import { TriageCase, SummaryStats, BatchResult } from "../lib/types";

export default function RevenueControlPage() {
  const [activeTab, setActiveTab] = useState<NavTab>("OVERVIEW");
  const [cases, setCases] = useState<TriageCase[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [isSseConnected, setIsSseConnected] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Deep-dive detail view
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<TriageCase | null>(null);

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState<boolean>(false);

  // Load all cases and stats
  const loadData = useCallback(async () => {
    try {
      const [casesData, statsData] = await Promise.all([
        fetchCases(),
        fetchSummaryStats(),
      ]);
      if (casesData) setCases(casesData);
      if (statsData) setStats(statsData);
    } catch (err) {
      console.error("Error loading triage state:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live SSE Connection
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        const sseUrl = getTriageSSEUrl();
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          setIsSseConnected(true);
        };

        eventSource.addEventListener("connected", () => {
          setIsSseConnected(true);
        });

        eventSource.addEventListener("triage_log", () => {
          loadData();
        });

        eventSource.onerror = () => {
          setIsSseConnected(false);
          eventSource?.close();
          setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.error("SSE setup error:", err);
        setIsSseConnected(false);
        setTimeout(connectSSE, 5000);
      }
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, [loadData]);

  // Periodic fallback refresh
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 4000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Advance single case
  const handleAdvanceCase = async (id: string) => {
    setProcessingId(id);
    try {
      const updated = await advanceCase(id);
      if (updated) {
        setCases((prev) => prev.map((c) => (c.id === id ? updated : c)));
        if (selectedCaseDetail && selectedCaseDetail.id === id) {
          setSelectedCaseDetail(updated);
        }
      }
      await loadData();
    } finally {
      setProcessingId(null);
    }
  };

  // Advance all active cases in the pipeline
  const handleAdvanceAll = async () => {
    const actionableCases = cases.filter(
      (c) => c.status === "NEW" || c.status === "DIAGNOSED" || c.status === "INTERVENING"
    );
    for (const c of actionableCases) {
      await handleAdvanceCase(c.id);
    }
  };

  // Resolve single case
  const handleResolveCase = async (
    id: string,
    resolution: "RECOVERED" | "LOST" | "ESCALATED",
    notes: string
  ) => {
    setProcessingId(id);
    try {
      const updated = await resolveCase(id, resolution, notes);
      if (updated) {
        setCases((prev) => prev.map((c) => (c.id === id ? updated : c)));
        if (selectedCaseDetail && selectedCaseDetail.id === id) {
          setSelectedCaseDetail(updated);
        }
      }
      await loadData();
    } finally {
      setProcessingId(null);
    }
  };

  // Run Batch Evaluation
  const handleRunBatch = async (count: number = 15) => {
    setIsBatchRunning(true);
    try {
      const result = await runBatchEvaluation(count);
      if (result) {
        setBatchResult(result);
      }
      await loadData();
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Ingest synthetic failure case
  const handleIngest = async (payload: {
    customer_name: string;
    plan_name: string;
    amount_paise: number;
    original_rail: string;
    error_code: string;
    error_desc: string;
  }) => {
    const created = await createCase(payload);
    if (created) {
      setCases((prev) => [created, ...prev]);
    }
    await loadData();
  };

  // Reset board
  const handleResetBoard = async () => {
    await resetTriageBoard();
    setSelectedCaseDetail(null);
    await loadData();
  };

  // Search filtered cases
  const filteredCases = useMemo(() => {
    if (!searchQuery.trim()) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q) ||
        c.plan_name.toLowerCase().includes(q) ||
        c.error_code.toLowerCase().includes(q) ||
        (c.diagnosis?.root_cause || "").toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  // STABLE SEPARATION: Split LIVE vs SYNTHETIC cases
  const liveCases = useMemo(() => {
    return filteredCases
      .filter((c) => c.source === "LIVE")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredCases]);

  const syntheticCases = useMemo(() => {
    return filteredCases
      .filter((c) => c.source !== "LIVE")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [filteredCases]);

  const exceptionCases = cases.filter(
    (c) => c.status === "LOST" || c.status === "ESCALATED"
  );

  return (
    <div className="min-h-screen flex bg-[#F5F6F6] text-[#202525]">
      {/* Left Compact Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedCaseDetail(null);
        }}
        exceptionCount={exceptionCases.length}
        totalCasesCount={liveCases.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar with Brand, Search, and Operational Status */}
        <TopBar
          activeTab={activeTab}
          isSseConnected={isSseConnected}
          onOpenBatchModal={() => setIsBatchModalOpen(true)}
          onOpenIngestModal={() => setIsIngestModalOpen(true)}
          onAdvanceAll={handleAdvanceAll}
          onResetBoard={handleResetBoard}
          isBatchRunning={isBatchRunning}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Main Body */}
        <main className="flex-1 p-5 max-w-[1500px] w-full mx-auto space-y-5">
          {/* Detailed Case View (Drill-Down) */}
          {selectedCaseDetail ? (
            <CaseDetailView
              caseItem={selectedCaseDetail}
              onBack={() => setSelectedCaseDetail(null)}
              onAdvance={handleAdvanceCase}
              onResolve={handleResolveCase}
            />
          ) : (
            <>
              {/* 1. OVERVIEW / DASHBOARD TAB (LIVE OPERATIONS ONLY) */}
              {activeTab === "OVERVIEW" && (
                <div className="space-y-4">
                  {/* Top 4 Operational KPI Cards computed strictly from LIVE transactions */}
                  <KpiMetrics liveCases={liveCases} />

                  {/* 2-Column Operational Telemetry Split: Root Causes & Webhook Telemetry */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-6">
                      <RevenueAtRiskBreakdown liveCases={liveCases} isSynthetic={false} />
                    </div>
                    <div className="lg:col-span-6">
                      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-4 font-sans space-y-3 flex flex-col justify-between h-full">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-[14px] tracking-wide text-[#202525] uppercase">
                              Live Storefront Telemetry
                            </h3>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#E6F4F1] text-[#087F83] border border-[#B2DFDB] uppercase flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#087F83] animate-pulse"></span>
                              SSE STREAM ACTIVE
                            </span>
                          </div>
                          <p className="text-[12px] text-[#6F7777] mt-1.5 leading-relaxed">
                            This live console listens exclusively for real checkouts from the <strong>Storefront (`localhost:5173`)</strong>. 
                            Events arrive with cryptographic HMAC verification and are tagged as <code className="text-[#2F855A] font-bold">LIVE · VERIFIED</code> (or <code className="text-[#DD6B20] font-bold">LIVE · SIMULATED</code>).
                          </p>
                        </div>

                        <div className="bg-[#F5F6F6] rounded-md p-3 border border-[#E2E5E5] text-[12px] space-y-1.5 font-mono">
                          <div className="flex justify-between text-[#6F7777]">
                            <span>Live Customer Declines:</span>
                            <span className="font-bold text-[#202525]">{liveCases.length}</span>
                          </div>
                          <div className="flex justify-between text-[#6F7777]">
                            <span>Recovered on Alternative Rails:</span>
                            <span className="font-bold text-[#2E7D5B]">{liveCases.filter(c => c.status === "RECOVERED").length}</span>
                          </div>
                          <div className="flex justify-between text-[#6F7777]">
                            <span>Synthetic Model Benchmark:</span>
                            <span className="text-[#087F83] font-semibold">{syntheticCases.length} Cases (in Evaluation tab)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Main Recovery Queue Table showing ONLY LIVE cases */}
                  <RecoveryQueueTable
                    cases={liveCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
                    title="Live Operations Recovery Queue"
                    subtitle={liveCases.length === 0 ? "Awaiting storefront events" : `${liveCases.length} live checkout failure${liveCases.length === 1 ? "" : "s"}`}
                  />
                </div>
              )}

              {/* 2. RECOVERY QUEUE TAB */}
              {activeTab === "RECOVERY" && (
                <div className="space-y-4">
                  <RecoveryQueueTable
                    cases={liveCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
                    title="Live Operations Queue"
                    subtitle={liveCases.length === 0 ? "Awaiting live checkout failures" : `${liveCases.length} live operational cases`}
                  />
                </div>
              )}

              {/* 3. CASES / PIPELINE TAB */}
              {activeTab === "CASES" && (
                <RecoveryPipelineView
                  cases={filteredCases}
                  onSelectCase={(c) => setSelectedCaseDetail(c)}
                  onAdvanceCase={handleAdvanceCase}
                  onAdvanceAll={handleAdvanceAll}
                  onOpenIngestModal={() => setIsIngestModalOpen(true)}
                  processingId={processingId}
                />
              )}

              {/* 4. PORTFOLIO ALLOCATOR TAB (KNAPSACK OPTIMIZATION) */}
              {activeTab === "ALLOCATOR" && (
                <PortfolioAllocatorView />
              )}

              {/* 5. EVALUATION TAB (EXCLUSIVELY FOR SYNTHETIC MODEL EVALUATION) */}
              {activeTab === "EVALUATION" && (
                <AnalyticsUpliftView
                  stats={stats}
                  onOpenBatchModal={() => setIsBatchModalOpen(true)}
                  isBatchRunning={isBatchRunning}
                />
              )}

              {/* 5. AUDIT LEDGER TAB */}
              {activeTab === "AUDIT" && (
                <PaymentsRailView
                  cases={filteredCases}
                  onSelectCase={(c) => setSelectedCaseDetail(c)}
                />
              )}

              {/* 6. PTP MONITOR TAB */}
              {activeTab === "PTP" && (
                <div className="space-y-4">
                  <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg p-5">
                    <h2 className="text-[16px] font-semibold uppercase text-[#202525]">
                      Promise-to-Pay (PTP) Operations
                    </h2>
                    <p className="text-[14px] font-normal text-[#6F7777] mt-1">
                      Select any active case from the queue below to inspect its deterministic date extraction or test Hindi/English conversational promises.
                    </p>
                  </div>
                  <RecoveryQueueTable
                    cases={liveCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
                    title="Live Cases PTP Queue"
                  />
                </div>
              )}

              {/* 7. REPORTS TAB */}
              {activeTab === "REPORTS" && (
                <CustomerMatrixView
                  cases={filteredCases}
                  onSelectCase={(c) => setSelectedCaseDetail(c)}
                />
              )}

              {/* 8. SETTINGS TAB */}
              {activeTab === "SETTINGS" && (
                <ExceptionsQueueView
                  cases={filteredCases}
                  onSelectCase={(c) => setSelectedCaseDetail(c)}
                  onResolve={handleResolveCase}
                  processingId={processingId}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Batch Evaluation Harness Modal */}
      <BatchEvaluationModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        result={batchResult}
        onRunBatch={handleRunBatch}
        isLoading={isBatchRunning}
        onSelectCase={(c) => {
          setSelectedCaseDetail(c);
          setIsBatchModalOpen(false);
        }}
      />

      {/* Ingest Simulated Failure Case Modal */}
      <IngestFailureModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        onIngest={handleIngest}
      />
    </div>
  );
}

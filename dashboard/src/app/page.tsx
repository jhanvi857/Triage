"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sidebar, NavTab } from "../components/Sidebar";
import { TopBar } from "../components/TopBar";
import { KpiMetrics } from "../components/KpiMetrics";
import { PerformanceChart } from "../components/PerformanceChart";
import { RecoveryQueueTable } from "../components/RecoveryQueueTable";
import { RevenueAtRiskBreakdown } from "../components/RevenueAtRiskBreakdown";
import { CaseDetailView } from "../components/CaseDetailView";
import { BatchEvaluationModal } from "../components/BatchEvaluationModal";
import { IngestFailureModal } from "../components/IngestFailureModal";
import { RecoveryPipelineView } from "../components/RecoveryPipelineView";
import { PaymentsRailView } from "../components/PaymentsRailView";
import { CustomerMatrixView } from "../components/CustomerMatrixView";
import { AnalyticsUpliftView } from "../components/AnalyticsUpliftView";
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
        totalCasesCount={cases.length}
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
              {/* 1. OVERVIEW / DASHBOARD TAB */}
              {activeTab === "OVERVIEW" && (
                <div className="space-y-4">
                  {/* Top 4 Operational KPI Cards */}
                  <KpiMetrics stats={stats} caseCount={cases.length} />

                  {/* Underneath: 2-Column Split (Recovery Performance + Root Causes) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7">
                      <PerformanceChart
                        currentRecoveryINR={stats?.total_recovered_inr}
                      />
                    </div>
                    <div className="lg:col-span-5">
                      <RevenueAtRiskBreakdown
                        totalAtRiskINR={stats?.total_at_risk_inr}
                      />
                    </div>
                  </div>

                  {/* Hero Main Component: Dense Recovery Queue Transaction Table */}
                  <RecoveryQueueTable
                    cases={filteredCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
                  />
                </div>
              )}

              {/* 2. RECOVERY QUEUE TAB */}
              {activeTab === "RECOVERY" && (
                <div className="space-y-4">
                  <RecoveryQueueTable
                    cases={filteredCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
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

              {/* 4. EVALUATION TAB */}
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
                    cases={filteredCases}
                    onSelectCase={(c) => setSelectedCaseDetail(c)}
                    onAdvanceCase={handleAdvanceCase}
                    processingId={processingId}
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

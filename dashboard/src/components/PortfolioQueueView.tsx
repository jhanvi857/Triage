"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ListOrdered,
  TrendingUp,
  ArrowUpDown,
  AlertCircle,
  Clock,
  Shield,
  HelpCircle,
  Layers,
  Sparkles,
  ChevronRight,
  DollarSign,
  Info,
} from "lucide-react";
import { fetchPortfolioSummary, advanceCase } from "../lib/api";
import { PortfolioSummary, PrioritizedOpportunity, TriageCase } from "../lib/types";

interface PortfolioQueueViewProps {
  onSelectCase?: (c: any) => void;
  onRefresh?: () => void;
}

export const PortfolioQueueView: React.FC<PortfolioQueueViewProps> = ({
  onSelectCase,
  onRefresh,
}) => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedOpp, setSelectedOpp] = useState<PrioritizedOpportunity | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchPortfolioSummary();
      if (data) {
        setSummary(data);
        if (data.queue && data.queue.length > 0 && !selectedOpp) {
          setSelectedOpp(data.queue[0]);
        }
      }
    } catch (err) {
      console.error("Portfolio load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOpp]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdvance = async (caseId: string) => {
    setActionLoading(caseId);
    try {
      await advanceCase(caseId);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Advance error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2.5 py-0.5 rounded border border-[#B2DFDB]">
              PORTFOLIO CONTROL PLANE
            </span>
            <span className="text-[11px] font-mono text-[#6F7777] bg-[#F5F6F6] px-2 py-0.5 rounded border border-[#E2E5E5]">
              TRANSPARENT EXPECTED-VALUE RANKING
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-[#202525] mt-1.5 leading-tight">
            Prioritized Recovery Portfolio Queue
          </h1>
          <p className="text-[12px] text-[#6F7777] mt-0.5 max-w-3xl">
            Prioritizes cross-workflow recovery opportunities by expected recovery value: <span className="font-mono text-[#087F83]">PriorityScore = (Gross EV - Concession - Cost) × TimeSensitivity × CustomerFactor - RiskPenalty</span>. No blind First-In-First-Out queues.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3.5 py-2 bg-[#F5F6F6] hover:bg-[#EAEAEA] border border-[#E2E5E5] text-[#202525] rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start md:self-auto transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#087F83]" /> Refresh Ranking
        </button>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Total Active Opportunities</span>
            <ListOrdered className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#202525]">
            {summary?.total_opportunities || 0}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Across subscriptions, carts, invoices
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Total Revenue At Risk</span>
            <DollarSign className="w-4 h-4 text-[#C93B2B]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#C93B2B]">
            ₹{(summary?.total_revenue_at_risk_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Unrecovered portfolio exposure
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Net Expected Recovery</span>
            <TrendingUp className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#087F83]">
            ₹{(summary?.total_expected_recovery_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Σ Net ERV (Gross - Cost)
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Priority Queue Status</span>
            <Shield className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-lg font-bold text-[#202525]">
            Dynamic (ERV-Ranked)
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Bounded time-decay functions
          </div>
        </div>
      </div>

      {/* 3. Main Priority Queue Table & Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Queue Table (2 Cols) */}
        <div className="lg:col-span-2 bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E2E5E5] flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-[#202525] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#087F83]" />
              Ranked Opportunities
            </h2>
            <span className="text-[11px] font-mono text-[#6F7777]">
              {summary?.queue?.length || 0} active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F9FAFA] border-b border-[#E2E5E5] text-[11px] font-medium text-[#6F7777]">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Case / Customer</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4 text-right">At Risk</th>
                  <th className="py-3 px-4 text-right">ERV (INR)</th>
                  <th className="py-3 px-4 text-right">Priority Score</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E5]">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#6F7777]">
                      Computing portfolio expected values...
                    </td>
                  </tr>
                ) : !summary?.queue || summary.queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#6F7777]">
                      No active opportunities currently require recovery intervention.
                    </td>
                  </tr>
                ) : (
                  summary.queue.map((opp) => {
                    const isSelected = selectedOpp?.case_id === opp.case_id;
                    return (
                      <tr
                        key={opp.case_id}
                        onClick={() => setSelectedOpp(opp)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-[#E6F4F1]/60" : "hover:bg-[#F9FAFA]"
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-[#087F83]">
                          #{opp.priority_rank}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#202525]">{opp.customer_name}</div>
                          <div className="text-[11px] font-mono text-[#6F7777]">{opp.case_id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#F0F4F4] text-[#334155] border border-[#CBD5E1]">
                            {opp.source_type || "PAYMENT"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-[#202525]">
                          ₹{opp.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#087F83] font-bold">
                          ₹{(opp.explanation.net_expected_recovery_inr || opp.explanation.gross_expected_recovery_inr).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#087F83]">
                          ₹{opp.priority_score.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdvance(opp.case_id);
                            }}
                            disabled={actionLoading === opp.case_id}
                            className="px-2.5 py-1 bg-[#087F83] hover:bg-[#066568] text-white rounded text-[11px] font-medium transition-colors disabled:opacity-50"
                          >
                            {actionLoading === opp.case_id ? "Executing..." : "Advance"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Selected Opportunity Explainer (1 Col) */}
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-xs p-5 space-y-4">
          <div className="border-b border-[#E2E5E5] pb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#202525] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#087F83]" />
              Priority Score Breakdown
            </h3>
            {selectedOpp && (
              <span className="font-mono text-[11px] font-bold text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded">
                Rank #{selectedOpp.priority_rank}
              </span>
            )}
          </div>

          {selectedOpp ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="text-[#6F7777] text-[11px]">Selected Opportunity</div>
                <div className="font-bold text-sm text-[#202525]">{selectedOpp.customer_name} ({selectedOpp.case_id})</div>
                <div className="text-[11px] font-mono text-[#6F7777]">Amount at Risk: ₹{selectedOpp.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
              </div>

              {/* Mathematical Equation Breakdown */}
              <div className="bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg p-3.5 space-y-2 font-mono text-[11px]">
                <div className="text-[10px] text-[#6F7777] uppercase tracking-wider font-bold">
                  DETERMINISTIC PRIORITY EQUATION
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Recovery Probability (P):</span>
                  <span className="font-bold text-[#202525]">{(selectedOpp.explanation.recovery_probability * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Gross Expected EV:</span>
                  <span className="font-bold text-[#202525]">₹{selectedOpp.explanation.gross_expected_recovery_inr.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Intervention Cost:</span>
                  <span className="text-[#C93B2B]">-₹{(selectedOpp.explanation.intervention_cost_paise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Net Action ERV:</span>
                  <span className="font-bold text-[#087F83]">₹{(selectedOpp.explanation.net_expected_recovery_inr || selectedOpp.explanation.gross_expected_recovery_inr).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Time Sensitivity:</span>
                  <span className="font-bold text-[#202525]">{selectedOpp.explanation.time_sensitivity.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Customer Value Factor:</span>
                  <span className="font-bold text-[#202525]">{selectedOpp.explanation.customer_value_factor.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#E2E5E5]/60">
                  <span className="text-[#6F7777]">Risk / Fraud Penalty:</span>
                  <span className="text-[#C93B2B]">-₹{(selectedOpp.explanation.risk_penalty_paise / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 text-[#087F83] font-bold text-[12px]">
                  <span>Final Priority Score:</span>
                  <span>₹{selectedOpp.priority_score.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-3 bg-[#E6F4F1] border border-[#B2DFDB] rounded-lg">
                <div className="flex items-center gap-1.5 text-[#087F83] font-bold text-[11px]">
                  <Info className="w-3.5 h-3.5" />
                  Why is this prioritized?
                </div>
                <p className="text-[11px] text-[#202525] mt-1">
                  {selectedOpp.explanation.time_sensitivity_reason}. Expected value is prioritized to maximize net money recovered while respecting human desk & budget capacity.
                </p>
              </div>

              {onSelectCase && (
                <button
                  onClick={() => onSelectCase({ id: selectedOpp.case_id })}
                  className="w-full py-2 bg-[#202525] hover:bg-[#333A3A] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                >
                  View Full Case Details <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="py-8 text-center text-[#6F7777] text-xs">
              Select an opportunity from the queue to view its priority explanation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

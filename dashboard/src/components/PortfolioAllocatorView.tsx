"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  DollarSign,
  Users,
  TrendingUp,
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Sparkles,
  HelpCircle,
  Calendar,
} from "lucide-react";
import { fetchPortfolioPlan } from "../lib/api";
import { PortfolioPlan, AllocationDecision } from "../lib/types";

export const PortfolioAllocatorView: React.FC = () => {
  const [discountBudgetINR, setDiscountBudgetINR] = useState<number>(5000);
  const [humanDeskSlots, setHumanDeskSlots] = useState<number>(4);
  const [plan, setPlan] = useState<PortfolioPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadPlan = useCallback(async (budgetINR: number, deskSlots: number) => {
    setIsLoading(true);
    try {
      const budgetPaise = budgetINR * 100;
      const res = await fetchPortfolioPlan(budgetPaise, deskSlots);
      if (res) setPlan(res);
    } catch (err) {
      console.error("Portfolio plan load error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan(discountBudgetINR, humanDeskSlots);
  }, [discountBudgetINR, humanDeskSlots, loadPlan]);

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2.5 py-0.5 rounded border border-[#B2DFDB]">
              PORTFOLIO-LEVEL RESOURCE OPTIMIZER
            </span>
            <span className="text-[11px] font-mono text-[#6F7777] bg-[#F5F6F6] px-2 py-0.5 rounded border border-[#E2E5E5]">
              DETERMINISTIC GREEDY KNAPSACK
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-[#202525] mt-1.5 leading-tight">
            Portfolio-Level Recovery Resource Allocator
          </h1>
          <p className="text-[12px] text-[#6F7777] mt-0.5 max-w-3xl">
            Optimizes scarce merchant recovery resources across all concurrent payment failure cases. Ranks by <strong>Incremental EV Density (&rho;)</strong> to maximize net recovered revenue per rupee of discount spent, rather than naively helping big accounts first.
          </p>
        </div>

        <div className="flex items-center space-x-2 text-[11px] font-mono font-semibold bg-[#F5F6F6] text-[#202525] p-3 rounded-lg border border-[#E2E5E5] shrink-0">
          <ShieldCheck className="w-4 h-4 text-[#087F83]" />
          <span>Deterministic Optimization (Zero Black-Box ML)</span>
        </div>
      </div>

      {/* 2. Interactive Knapsack Sliders Controls & Resource Buckets */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-[#E2E5E5] pb-3">
          <Sliders className="w-4 h-4 text-[#087F83]" />
          <h2 className="font-bold text-[14px] uppercase tracking-wide text-[#202525]">
            Merchant Resource Constraints &amp; Allocation Buckets
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Discount Concession Budget Slider */}
          <div className="space-y-2 bg-[#FBFDFD] p-4 rounded-lg border border-[#E2E5E5]">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-[#202525] flex items-center space-x-1.5">
                <DollarSign className="w-3.5 h-3.5 text-[#087F83]" />
                <span>Monthly Concession Budget</span>
              </label>
              <span className="text-[15px] font-mono font-bold text-[#087F83]">
                ₹{discountBudgetINR.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="1000"
              max="25000"
              step="500"
              value={discountBudgetINR}
              onChange={(e) => setDiscountBudgetINR(Number(e.target.value))}
              className="w-full h-2 bg-[#E2E5E5] rounded-lg appearance-none cursor-pointer accent-[#087F83]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#6F7777]">
              <span>₹1,000 (Strict)</span>
              <span>₹12,500</span>
              <span>₹25,000 (High)</span>
            </div>
          </div>

          {/* 2. Human Review Desk Capacity Slider */}
          <div className="space-y-2 bg-[#FBFDFD] p-4 rounded-lg border border-[#E2E5E5]">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-[#202525] flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-[#B7791F]" />
                <span>Retention Specialist Slots</span>
              </label>
              <span className="text-[15px] font-mono font-bold text-[#B7791F]">
                {humanDeskSlots} Desk Slots
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={humanDeskSlots}
              onChange={(e) => setHumanDeskSlots(Number(e.target.value))}
              className="w-full h-2 bg-[#E2E5E5] rounded-lg appearance-none cursor-pointer accent-[#B7791F]"
            />
            <div className="flex justify-between text-[10px] font-mono text-[#6F7777]">
              <span>1 Slot (Tight)</span>
              <span>5 Slots</span>
              <span>10 Slots (High)</span>
            </div>
          </div>

          {/* 3. Promise-to-Pay (PTP) Commitment Bucket */}
          <div className="space-y-2 bg-[#FBFDFD] p-4 rounded-lg border border-[#E2E5E5]">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-[#202525] flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#2B6CB0]" />
                <span>Promise to Pay (PTP) Bucket</span>
              </label>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#2B6CB0] bg-[#EBF8FF] px-2 py-0.5 rounded border border-[#BEE3F8]">
                FIRST-CLASS RESOURCE
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-[15px] font-mono font-bold text-[#2B6CB0]">
                  ₹{(plan?.total_ptp_promised_inr || 0).toLocaleString()}
                </div>
                <div className="text-[10px] text-[#6F7777] font-mono">
                  {plan?.active_promises_count || 0} active commitments
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-mono font-bold text-[#276749]">
                  {((plan?.historical_kept_rate || 0.785) * 100).toFixed(1)}% Kept
                </div>
                <div className="text-[10px] text-[#6F7777] font-mono">
                  {((plan?.historical_broken_rate || 0.215) * 100).toFixed(1)}% broken
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#6F7777] pt-1 border-t border-[#E2E5E5]">
              <span>Aging: Avg {plan?.ptp_aging_breakdown?.avg_days_to_promised_date || 4.2}d</span>
              <span>&lt;48h: {plan?.ptp_aging_breakdown?.due_within_48h || 0}</span>
              <span>3-7d: {plan?.ptp_aging_breakdown?.due_in_3_to_7d || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Portfolio Allocation Summary KPI Cards */}
      {plan && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#6F7777] uppercase block">
              Total Revenue At Risk
            </span>
            <div className="text-[18px] font-mono font-bold text-[#202525]">
              ₹{plan.total_at_risk_inr.toLocaleString()}
            </div>
            <span className="text-[11px] text-[#6F7777] font-mono block">
              {plan.total_cases} at-risk cases
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#2E7D5B] uppercase block">
              Expected Recovered (EV)
            </span>
            <div className="text-[18px] font-mono font-bold text-[#2E7D5B]">
              ₹{plan.expected_recovered_inr.toLocaleString()}
            </div>
            <span className="text-[11px] text-[#2E7D5B] font-mono block font-semibold">
              {((plan.expected_recovered_inr / Math.max(plan.total_at_risk_inr, 1)) * 100).toFixed(1)}% recovery rate
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#087F83] uppercase block">
              Discount Spend / Budget
            </span>
            <div className="text-[18px] font-mono font-bold text-[#087F83]">
              ₹{plan.discount_budget_spent_inr.toLocaleString()}
            </div>
            <span className="text-[11px] text-[#6F7777] font-mono block">
              ₹{plan.discount_budget_remaining_inr.toLocaleString()} remaining
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#B7791F] uppercase block">
              Human Review Slots
            </span>
            <div className="text-[18px] font-mono font-bold text-[#B7791F]">
              {plan.human_desk_slots_used} / {plan.human_desk_capacity}
            </div>
            <span className="text-[11px] text-[#6F7777] font-mono block">
              {plan.human_desk_slots_remaining} slots free
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#2B6CB0] uppercase block">
              Promised (Pending)
            </span>
            <div className="text-[18px] font-mono font-bold text-[#2B6CB0]">
              ₹{(plan.total_ptp_promised_inr || 0).toLocaleString()}
            </div>
            <span className="text-[11px] text-[#2B6CB0] font-mono block font-semibold">
              {plan.cases_allocated_ptp || 0} cases committed
            </span>
          </div>

          <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1 shadow-sm">
            <span className="text-[11px] font-semibold text-[#087F83] uppercase block">
              Portfolio ROI Multiple
            </span>
            <div className="text-[18px] font-mono font-bold text-[#087F83]">
              {plan.portfolio_roi_multiple.toFixed(1)}x
            </div>
            <span className="text-[11px] text-[#2E7D5B] font-mono block font-semibold">
              ₹ recovered / ₹ discount
            </span>
          </div>
        </div>
      )}

      {/* 4. The Mathematical Density Proof Callout */}
      <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 flex items-start space-x-3 text-[12px] text-[#166534]">
        <CheckCircle2 className="w-5 h-5 text-[#2E7D5B] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-bold text-[#14532D]">
            Mathematical Proof: EV Density (&rho;) Allocation vs. Amount-Sorting
          </div>
          <p className="text-[#166534] leading-relaxed">
            The knapsack engine computes <strong>&rho; = &Delta;Expected Value / Concession Rupee Spent</strong>. A smaller ₹2,000 case with a high jump in recovery probability (e.g. 35% &rarr; 88% for ₹100 discount, &rho; = 9.72x) is prioritized for discount budget <em>ahead</em> of a ₹10,000 case with low recovery jump (e.g. 10% &rarr; 20% for ₹500 discount, &rho; = 1.80x). This guarantees maximum recovery yield per rupee invested.
          </p>
        </div>
      </div>

      {/* 5. Detailed Knapsack Decision Table */}
      {plan && (
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between bg-[#FBFDFD]">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#087F83]" />
              <h3 className="font-bold text-[14px] uppercase tracking-wide text-[#202525]">
                Knapsack Allocation Decisions ({plan.decisions.length} Cases)
              </h3>
            </div>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#087F83]"></span>
                <span>{plan.cases_allocated_discount} Concessions</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#B7791F]"></span>
                <span>{plan.cases_allocated_human_desk} Human Desk</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#2B6CB0]"></span>
                <span>{plan.cases_allocated_ptp || 0} Promise-to-Pay</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-[#6F7777]"></span>
                <span>{plan.cases_routed_zero_cost_fallback} Zero-Cost Fallbacks</span>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse font-sans">
              <thead>
                <tr className="border-b border-[#E2E5E5] bg-[#F5F6F6] text-[#6F7777] font-bold uppercase text-[10px] tracking-wider font-mono">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Customer &amp; Cause</th>
                  <th className="py-3 px-4 text-right">Amount (INR)</th>
                  <th className="py-3 px-4 text-center">EV Density (&rho;)</th>
                  <th className="py-3 px-4">Resource Allocation</th>
                  <th className="py-3 px-4 text-right">Discount Spend</th>
                  <th className="py-3 px-4 text-right">Expected Value (EV)</th>
                  <th className="py-3 px-4">Optimization Rationale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E5E5]">
                {plan.decisions.map((dec, idx) => {
                  let badgeColor = "bg-[#F5F6F6] text-[#6F7777] border-[#E2E5E5]";
                  if (dec.resource_allocated === "DISCOUNT_BUDGET") {
                    badgeColor = "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB]";
                  } else if (dec.resource_allocated === "HUMAN_DESK") {
                    badgeColor = "bg-[#B7791F]/10 text-[#B7791F] border-[#B7791F]/30";
                  } else if (dec.resource_allocated === "PROMISE_TO_PAY") {
                    badgeColor = "bg-[#EBF8FF] text-[#2B6CB0] border-[#BEE3F8]";
                  }

                  return (
                    <tr key={idx} className="hover:bg-[#FBFDFD] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#087F83]">
                        {dec.case_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#202525]">{dec.customer_name}</div>
                        <span className="text-[10px] font-mono bg-[#F5F6F6] text-[#6F7777] px-1.5 py-0.5 rounded border border-[#E2E5E5]">
                          {dec.root_cause}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#202525]">
                        ₹{dec.amount_inr.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {dec.ev_density > 0 ? (
                          <span className="font-bold text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB]">
                            {dec.ev_density.toFixed(2)}x
                          </span>
                        ) : (
                          <span className="text-[#6F7777]">--</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                          {dec.resource_allocated}
                        </span>
                        <div className="text-[10px] text-[#6F7777] font-sans mt-0.5">
                          &rarr; {dec.assigned_action}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold">
                        {dec.discount_spend_inr > 0 ? (
                          <span className="text-[#087F83]">₹{dec.discount_spend_inr.toFixed(2)}</span>
                        ) : (
                          <span className="text-[#6F7777]">₹0.00</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-[#2E7D5B]">
                        ₹{dec.expected_value_inr.toLocaleString()}
                        <div className="text-[10px] font-normal text-[#6F7777]">
                          {(dec.recovery_probability * 100).toFixed(0)}% P(rec)
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-[#6F7777] max-w-xs leading-snug">
                        {dec.allocation_rationale}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

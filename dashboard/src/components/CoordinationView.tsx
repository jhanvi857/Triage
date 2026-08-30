"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
  CheckCircle2,
  Ban,
  DollarSign,
} from "lucide-react";
import { fetchCustomerState, fetchCases } from "../lib/api";
import { CustomerState, TriageCase } from "../lib/types";

export const CoordinationView: React.FC = () => {
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("cust_acme_multi");
  const [state, setState] = useState<CustomerState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Discover customers from active cases
  useEffect(() => {
    const init = async () => {
      const cases = await fetchCases();
      if (cases && cases.length > 0) {
        const custSet = new Set<string>();
        cases.forEach((c) => {
          if (c.customer_id) custSet.add(c.customer_id);
        });
        const list = Array.from(custSet);
        setCustomers(list);
        if (!list.includes(selectedCustomer) && list.length > 0) {
          setSelectedCustomer(list[0]);
        }
      }
    };
    init();
  }, []);

  const loadState = async (custId: string) => {
    setIsLoading(true);
    try {
      const data = await fetchCustomerState(custId);
      if (data) setState(data);
    } catch (err) {
      console.error("fetchCustomerState error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) loadState(selectedCustomer);
  }, [selectedCustomer]);

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2.5 py-0.5 rounded border border-[#B2DFDB]">
              CROSS-WORKFLOW COORDINATION
            </span>
            <span className="text-[11px] font-mono text-[#6F7777] bg-[#F5F6F6] px-2 py-0.5 rounded border border-[#E2E5E5]">
              CUSTOMER HARASSMENT PREVENTION
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-[#202525] mt-1.5 leading-tight">
            Customer Cross-Workflow Recovery Coordinator
          </h1>
          <p className="text-[12px] text-[#6F7777] mt-0.5 max-w-3xl">
            Coordinates competing recovery attempts across subscriptions, checkouts, and invoices for the same customer. Enforces mandatory cooldowns, contact frequency limits, and high-value priority suppression.
          </p>
        </div>

        {/* Customer Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-medium text-[#6F7777]">Customer ID:</span>
          <select
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
            className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E2E5E5] text-[#202525] rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-[#087F83]"
          >
            {customers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Customer State Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Customer Name</span>
            <Users className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-lg font-bold text-[#202525] truncate">
            {state?.customer_name || selectedCustomer}
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#6F7777]">
            {selectedCustomer}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Total Customer Risk</span>
            <DollarSign className="w-4 h-4 text-[#C93B2B]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#C93B2B]">
            ₹{(state?.total_revenue_at_risk_inr || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Aggregated across all open items
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Cooldown Status</span>
            <Clock className={`w-4 h-4 ${state?.cooldown_active ? "text-[#F57F17]" : "text-[#2E7D32]"}`} />
          </div>
          <div className={`mt-2 text-lg font-bold font-mono ${state?.cooldown_active ? "text-[#F57F17]" : "text-[#2E7D32]"}`}>
            {state?.cooldown_active ? "COOLDOWN ACTIVE" : "READY FOR CONTACT"}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            {state?.cooldown_active ? "Suppressing duplicate contacts" : "4h minimum gap respected"}
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Active Opportunities</span>
            <Layers className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#087F83]">
            {state?.active_opportunities?.length || 0}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Distinct revenue-risk surfaces
          </div>
        </div>
      </div>

      {/* 3. Multi-Opportunity Coordination Matrix Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#202525] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#087F83]" />
            Active Opportunities for {state?.customer_name || selectedCustomer}
          </h2>
          <span className="text-[11px] font-mono text-[#6F7777]">
            Coordinated by priority & value
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFA] border-b border-[#E2E5E5] text-[#6F7777] uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-2.5 px-4">Case ID</th>
                <th className="py-2.5 px-4">Revenue Surface</th>
                <th className="py-2.5 px-4 text-right">Amount (INR)</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Planned Action</th>
                <th className="py-2.5 px-4">Coordination Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {state?.active_opportunities && state.active_opportunities.length > 0 ? (
                state.active_opportunities.map((opp, idx) => {
                  const isHighest =
                    idx === 0 ||
                    state.active_opportunities.every((o) => opp.amount_paise >= o.amount_paise);
                  const isSuppressed = !isHighest && state.active_opportunities.length > 1;

                  return (
                    <tr key={opp.case_id} className="hover:bg-[#F5F6F6] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#202525]">{opp.case_id}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono ${
                          opp.source_type === "ABANDONED_CHECKOUT"
                            ? "bg-[#FFF8E1] text-[#F57F17] border border-[#FFE082]"
                            : opp.source_type === "FAILED_SUBSCRIPTION"
                            ? "bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]"
                            : opp.source_type === "OVERDUE_INVOICE"
                            ? "bg-[#EDE7F6] text-[#512DA8] border border-[#D1C4E9]"
                            : "bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]"
                        }`}>
                          {opp.source_type || "FAILED_PAYMENT"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[#202525]">
                        ₹{opp.amount_inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-[#6F7777]">{opp.status}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-[#202525]">
                        {opp.action || "Context Evaluation"}
                      </td>
                      <td className="py-3 px-4">
                        {isSuppressed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#FFF8E1] text-[#F57F17] border border-[#FFE082]">
                            <Ban className="w-3 h-3" /> SUPPRESSED (LOWER PRIORITY)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E8F5E9] text-[#2E7D32] border border-[#C8E6C9]">
                            <CheckCircle2 className="w-3 h-3" /> PROCEED (HIGHEST VALUE)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6F7777]">
                    {isLoading ? "Loading customer state..." : "No active opportunities found for this customer."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Coordination Rules & Guardrails Panel */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-[#202525] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#087F83]" />
          Deterministic Cross-Workflow Guardrails
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg">
            <div className="font-bold text-[#202525]">1. Contact Cooldown (4h)</div>
            <div className="text-[11px] text-[#6F7777] mt-1">
              Guarantees at least 4 hours between any customer recovery communication across all workflows.
            </div>
          </div>
          <div className="p-3 bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg">
            <div className="font-bold text-[#202525]">2. Priority Suppression</div>
            <div className="text-[11px] text-[#6F7777] mt-1">
              If multiple items are active, higher-value carts/invoices are prioritized; lower-value messages are suppressed.
            </div>
          </div>
          <div className="p-3 bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg">
            <div className="font-bold text-[#202525]">3. Global Fraud Freeze</div>
            <div className="text-[11px] text-[#6F7777] mt-1">
              A fraud flag on any transaction freezes automated recovery across all accounts for that customer.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hash,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import { AuditEntry, RuleEvaluation } from "../lib/types";

interface LiveAuditFeedProps {
  entries: AuditEntry[];
  isConnected: boolean;
}

export const LiveAuditFeed: React.FC<LiveAuditFeedProps> = ({ entries, isConnected }) => {
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [filterAgent, setFilterAgent] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter entries
  const filtered = entries.filter((e) => {
    if (filterDecision !== "ALL" && e.gate_decision !== filterDecision && e.status !== filterDecision) {
      return false;
    }
    if (filterAgent !== "ALL" && e.agent_id !== filterAgent) {
      return false;
    }
    return true;
  });

  // Extract unique agents for dropdown
  const uniqueAgents = Array.from(new Set(entries.map((e) => e.agent_id))).filter(Boolean);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getVerdictBadge = (decision: string, status: string) => {
    const term = decision || status;
    if (term === "APPROVED" || status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
          <CheckCircle2 className="w-3 h-3" />
          APPROVED
        </span>
      );
    }
    if (term === "PENDING_APPROVAL" || status === "PENDING_APPROVAL") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-950/40 text-amber-300 border border-amber-800/40">
          <AlertTriangle className="w-3 h-3" />
          GATED
        </span>
      );
    }
    if (term === "REJECTED" || status === "REJECTED") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-red-950/40 text-red-300 border border-red-800/40">
          <XCircle className="w-3 h-3" />
          REJECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
        {term}
      </span>
    );
  };

  return (
    <div className="p-5 rounded-xl bg-surface border border-surface-border">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight">Append-Only Audit Log</h2>
            <span
              id="status-sse-indicator"
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-zinc-500"}`} />
              {isConnected ? "LIVE STREAM" : "POLLING"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Immutable SHA-256 hash-chain documenting all agent reasoning, gateway rules &amp; Razorpay payments
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <select
            id="filter-decision"
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-zinc-500 font-mono"
          >
            <option value="ALL">All Verdicts</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_APPROVAL">Gated / Pending</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            id="filter-agent"
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-md px-2.5 py-1 focus:outline-none focus:border-zinc-500 font-mono"
          >
            <option value="ALL">All Agents ({entries.length} records)</option>
            {uniqueAgents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Events Feed */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
            <Activity className="w-6 h-6 text-zinc-600 mb-1.5" />
            <p className="text-xs font-medium text-zinc-400">No audit events recorded yet</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Execute agent purchases or trigger demo scenarios to populate the ledger.
            </p>
          </div>
        ) : (
          filtered.map((entry, index) => {
            const isExpanded = expandedId === entry.id;
            let ruleDetails: RuleEvaluation[] = [];
            if (entry.rule_breakdown) {
              try {
                ruleDetails = JSON.parse(entry.rule_breakdown);
              } catch (_) {}
            }

            return (
              <div
                key={entry.id || entry.event_id || index}
                id={`audit-row-${entry.event_id || index}`}
                className={`p-3 rounded-lg border transition-colors ${
                  isExpanded ? "bg-zinc-900 border-zinc-700" : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700"
                }`}
              >
                {/* Main Card Header */}
                <div
                  className="flex items-start justify-between cursor-pointer select-none"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <div className="flex items-start space-x-2.5">
                    <div className="mt-0.5 text-zinc-500">
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-white" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-medium text-zinc-300">
                          {entry.action}
                        </span>
                        {getVerdictBadge(entry.gate_decision, entry.status)}
                        {entry.amount_paise > 0 && (
                          <span className="text-xs font-mono font-bold text-white">
                            ₹{(entry.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                        <span>Agent: <strong className="text-zinc-300 font-normal">{entry.agent_id}</strong></span>
                        <span className="text-zinc-600">&bull;</span>
                        <span className="text-zinc-400 font-mono">{entry.event_id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-zinc-400 font-mono">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Stated Agent Reasoning Quote Box */}
                {entry.reasoning && (
                  <div className="mt-2.5 ml-6 p-2.5 rounded bg-zinc-950 border-l-2 border-zinc-500 text-xs">
                    <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-wider block mb-0.5">
                      Stated Agent Reasoning:
                    </span>
                    <p className="text-zinc-300 font-sans leading-relaxed text-[11px]">
                      &ldquo;{entry.reasoning}&rdquo;
                    </p>
                  </div>
                )}

                {/* Gate Reason Summary */}
                {entry.gate_reason && (
                  <div className="mt-1.5 ml-6 text-[11px] text-zinc-400 flex items-start gap-1.5">
                    <span className="text-zinc-500 font-mono uppercase text-[9px] shrink-0 mt-0.5">Rule:</span>
                    <span className="text-zinc-300">{entry.gate_reason}</span>
                  </div>
                )}

                {/* Expanded Details: Rules Tree & Cryptographic Hash */}
                {isExpanded && (
                  <div className="mt-3 ml-6 pt-3 border-t border-zinc-800 space-y-2.5">
                    {/* Evaluated Rules Breakdown */}
                    {ruleDetails.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                          Explainability Evaluation Tree
                        </h4>
                        <div className="space-y-1">
                          {ruleDetails.map((rule, rIdx) => (
                            <div
                              key={rIdx}
                              className="p-2 rounded bg-zinc-950 border border-zinc-800/80 text-xs flex items-start justify-between"
                            >
                              <div className="space-y-0.5">
                                <div className="font-mono text-[11px] text-zinc-200 flex items-center gap-1.5">
                                  <span>{rule.rule_name}</span>
                                  {rule.requires_approval && (
                                    <span className="text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/50 px-1 rounded">
                                      Gated
                                    </span>
                                  )}
                                </div>
                                <div className="text-zinc-400 text-[10px]">{rule.reason}</div>
                              </div>
                              <span
                                className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  rule.passed
                                    ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/40"
                                    : "bg-red-950/40 text-red-300 border border-red-800/40"
                                }`}
                              >
                                {rule.passed ? "PASS" : "FAIL"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metadata & Razorpay Order Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950 p-2.5 rounded border border-zinc-800">
                      {entry.order_id && (
                        <div>
                          <span className="text-zinc-500">Order: </span>
                          <span className="text-zinc-300">{entry.order_id}</span>
                        </div>
                      )}
                      {entry.idempotency_key && (
                        <div>
                          <span className="text-zinc-500">Idempotency: </span>
                          <span className="text-zinc-400">{entry.idempotency_key}</span>
                        </div>
                      )}
                    </div>

                    {/* Cryptographic SHA-256 Hash Chain Proof */}
                    {entry.entry_hash && (
                      <div className="p-2 rounded bg-black border border-zinc-800 text-[10px] font-mono space-y-0.5">
                        <div className="flex items-center gap-1 text-zinc-400 font-bold uppercase text-[9px]">
                          <Hash className="w-2.5 h-2.5 text-zinc-400" />
                          <span>SHA-256 Proof</span>
                        </div>
                        <div className="text-zinc-500 truncate">
                          Prev: <span className="text-zinc-400">{entry.prev_hash}</span>
                        </div>
                        <div className="text-zinc-300 truncate">
                          Hash: <span className="text-zinc-200 font-semibold">{entry.entry_hash}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

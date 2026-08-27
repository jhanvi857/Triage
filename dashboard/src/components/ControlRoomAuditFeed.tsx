"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Hash,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
} from "lucide-react";
import { AuditEntry, RuleEvaluation } from "../lib/types";

interface ControlRoomAuditFeedProps {
  entries: AuditEntry[];
  isConnected: boolean;
}

// Physical Circular Ledger Stamp Component
const VerdictStamp: React.FC<{ verdict: string; status: string; id: string }> = ({
  verdict,
  status,
  id,
}) => {
  const prefersReducedMotion = useReducedMotion();

  const term = (verdict || status || "").toUpperCase();
  let label = "LOGGED";
  let color = "#4C8DFF"; // Default blue
  let rotation = -8;

  if (term === "APPROVED" || status === "PAID" || term === "PAYMENT_CAPTURED") {
    label = "APPROVED";
    color = "#34D399";
    rotation = -10;
  } else if (term === "PENDING_APPROVAL" || status === "PENDING_APPROVAL" || term === "APPROVAL_REQUESTED") {
    label = "GATED";
    color = "#F5A623";
    rotation = 8;
  } else if (term === "REJECTED" || status === "REJECTED" || term === "OVER_BUDGET_REJECTED") {
    label = "REJECTED";
    color = "#F04F4F";
    rotation = -12;
  } else if (term === "IDEMPOTENCY_REPLAY" || status === "REPLAYED") {
    label = "REPLAYED";
    color = "#4C8DFF";
    rotation = 0;
  }

  // Deterministic slight angle offset based on entry ID char
  const hashVal = id ? id.charCodeAt(id.length - 1) % 5 - 2 : 0;
  const finalRotation = rotation + hashVal;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 2.2, opacity: 0, rotate: finalRotation - 20 }}
      animate={{ scale: 1, opacity: 0.92, rotate: finalRotation }}
      transition={{ type: "spring" as const, stiffness: 350, damping: 20, mass: 0.8 }}
      className="absolute top-2.5 right-3 pointer-events-none select-none z-10"
    >
      <div
        style={{ borderColor: color, color }}
        className="w-18 h-18 rounded-full border-2 border-dashed flex items-center justify-center p-0.5"
      >
        <div
          style={{ borderColor: color }}
          className="w-full h-full rounded-full border flex flex-col items-center justify-center text-center p-1 bg-[#0B0E14]/70 backdrop-blur-xs"
        >
          <span className="text-[7px] font-mono tracking-widest uppercase opacity-75">
            ★ LEDGER ★
          </span>
          <span className="text-[10px] font-mono font-black tracking-wider uppercase leading-none my-0.5">
            {label}
          </span>
          <span className="text-[6px] font-mono uppercase opacity-60">GATE VERIFIED</span>
        </div>
      </div>
    </motion.div>
  );
};

export const ControlRoomAuditFeed: React.FC<ControlRoomAuditFeedProps> = ({
  entries,
  isConnected,
}) => {
  const [filterDecision, setFilterDecision] = useState<string>("ALL");
  const [filterAgent, setFilterAgent] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

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

  const uniqueAgents = Array.from(new Set(entries.map((e) => e.agent_id))).filter(Boolean);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full bg-[#131720] border border-[#1E2638] rounded-lg p-4 space-y-3">
      {/* Feed Header & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#1E2638]">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#4C8DFF]" />
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#E4E7EB]">
                Live Audit Stream
              </h2>
              <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.2 rounded bg-[#0B0E14] border border-[#1E2638]">
                {filtered.length} EVENTS
              </span>
            </div>
            <p className="text-[10px] text-zinc-400">Append-only SHA-256 hash-chain</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-1.5">
          <Filter className="w-3 h-3 text-zinc-500" />
          <select
            value={filterDecision}
            onChange={(e) => setFilterDecision(e.target.value)}
            className="bg-[#0B0E14] border border-[#1E2638] text-zinc-300 text-[11px] font-mono rounded px-2 py-1 focus:outline-none focus:border-[#4C8DFF]"
          >
            <option value="ALL">All Verdicts</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_APPROVAL">Gated</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-[#0B0E14] border border-[#1E2638] text-zinc-300 text-[11px] font-mono rounded px-2 py-1 focus:outline-none focus:border-[#4C8DFF]"
          >
            <option value="ALL">All Agents</option>
            {uniqueAgents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Entries Stream */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#1E2638] rounded-lg bg-[#0E121B]">
            <Activity className="w-6 h-6 text-zinc-600 mb-2" />
            <p className="text-xs font-mono text-zinc-400">Awaiting Agent Transactions...</p>
            <p className="text-[10px] text-zinc-600 mt-1">
              Trigger a scenario from the header bar to stream live audit events.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((entry, index) => {
              const isExpanded = expandedId === entry.id;
              let ruleDetails: RuleEvaluation[] = [];
              if (entry.rule_breakdown) {
                try {
                  ruleDetails = JSON.parse(entry.rule_breakdown);
                } catch (_) {}
              }

              return (
                <motion.div
                  key={entry.id || entry.event_id || index}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" as const }}
                  id={`audit-entry-${entry.event_id || index}`}
                  className={`relative p-3.5 rounded-lg border transition-all overflow-hidden ${
                    isExpanded
                      ? "bg-[#181D29] border-[#4C8DFF]/60"
                      : "bg-[#0E121B] border-[#1E2638] hover:border-zinc-600"
                  }`}
                >
                  {/* The Signature Physical Circular Stamp */}
                  <VerdictStamp
                    verdict={entry.gate_decision}
                    status={entry.status}
                    id={entry.id || entry.event_id}
                  />

                  {/* Entry Header Info */}
                  <div
                    className="flex items-start justify-between cursor-pointer select-none pr-16"
                    onClick={() => toggleExpand(entry.id)}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className="mt-0.5 text-zinc-500">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-[#4C8DFF]" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono font-bold text-[#E4E7EB]">
                            {entry.action}
                          </span>
                          {entry.amount_paise > 0 && (
                            <span className="text-xs font-mono font-black text-white px-1.5 py-0.2 rounded bg-[#0B0E14] border border-[#1E2638]">
                              ₹{(entry.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-zinc-400 mt-0.5 flex items-center gap-1.5">
                          <span>Agent: <strong className="text-zinc-300 font-medium">{entry.agent_id}</strong></span>
                          <span className="text-zinc-600">&bull;</span>
                          <span className="text-zinc-400 font-mono text-[10px]">{entry.event_id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-mono text-zinc-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Stated Agent Reasoning (High Contrast Stated Reasoning) */}
                  {entry.reasoning && (
                    <div className="mt-2.5 ml-6 p-2.5 rounded bg-[#0B0E14] border-l-2 border-[#4C8DFF] text-xs">
                      <div className="text-[9px] font-mono text-[#4C8DFF] font-bold uppercase tracking-wider mb-0.5">
                        Stated Agent Reasoning
                      </div>
                      <p className="text-[#E4E7EB] font-sans text-[11px] leading-relaxed">
                        &ldquo;{entry.reasoning}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Gate Rule Reason */}
                  {entry.gate_reason && (
                    <div className="mt-1.5 ml-6 text-[11px] text-zinc-400 flex items-start gap-1.5">
                      <span className="text-zinc-500 font-mono uppercase text-[9px] shrink-0 mt-0.5">Gate Reason:</span>
                      <span className="text-zinc-300">{entry.gate_reason}</span>
                    </div>
                  )}

                  {/* Expanded Explainability Details */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 pt-3 border-t border-[#1E2638] space-y-2.5 animate-fade-in">
                      {/* Rule Breakdown Checklist */}
                      {ruleDetails.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                            Rule Engine Evaluation Breakdown
                          </div>
                          <div className="space-y-1">
                            {ruleDetails.map((rule, rIdx) => (
                              <div
                                key={rIdx}
                                className="p-2 rounded bg-[#0B0E14] border border-[#1E2638] text-xs flex items-start justify-between"
                              >
                                <div className="space-y-0.5">
                                  <div className="font-mono text-[11px] text-zinc-200 flex items-center gap-1.5">
                                    <span>{rule.rule_name}</span>
                                    {rule.requires_approval && (
                                      <span className="text-[9px] bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40 px-1 rounded">
                                        Manual Review Required
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-zinc-400 text-[10px]">{rule.reason}</div>
                                </div>
                                <span
                                  className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    rule.passed
                                      ? "bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40"
                                      : "bg-[#F04F4F]/20 text-[#F04F4F] border border-[#F04F4F]/40"
                                  }`}
                                >
                                  {rule.passed ? "PASS" : "FAIL"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Order & Idempotency Metadata */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono bg-[#0B0E14] p-2.5 rounded border border-[#1E2638]">
                        {entry.order_id && (
                          <div>
                            <span className="text-zinc-500">Order ID: </span>
                            <span className="text-zinc-200">{entry.order_id}</span>
                          </div>
                        )}
                        {entry.idempotency_key && (
                          <div>
                            <span className="text-zinc-500">Idempotency Key: </span>
                            <span className="text-zinc-400">{entry.idempotency_key}</span>
                          </div>
                        )}
                      </div>

                      {/* SHA-256 Hash Chain Proof */}
                      {entry.entry_hash && (
                        <div className="p-2 rounded bg-black border border-[#1E2638] text-[10px] font-mono space-y-0.5">
                          <div className="flex items-center gap-1 text-zinc-400 font-bold uppercase text-[9px]">
                            <Hash className="w-2.5 h-2.5 text-[#34D399]" />
                            <span>SHA-256 Cryptographic Chain Link</span>
                          </div>
                          <div className="text-zinc-500 truncate">
                            Prev: <span className="text-zinc-400">{entry.prev_hash}</span>
                          </div>
                          <div className="text-[#34D399] truncate font-semibold">
                            Entry Hash: <span>{entry.entry_hash}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

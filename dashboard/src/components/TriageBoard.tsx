"use client";

import React from "react";
import { AnimatePresence } from "framer-motion";
import { TriageCaseCard } from "./TriageCaseCard";
import { TriageCase } from "../lib/types";
import { Inbox, Stethoscope, Zap, CheckCircle, AlertTriangle } from "lucide-react";

interface TriageBoardProps {
  cases: TriageCase[];
  onAdvanceCase: (id: string) => Promise<void>;
  onResolveCase: (id: string, resolution: "RECOVERED" | "LOST" | "ESCALATED", notes: string) => Promise<void>;
  onSelectCase: (caseItem: TriageCase) => void;
  processingId: string | null;
}

interface ColumnConfig {
  id: string;
  title: string;
  statuses: string[];
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  desc: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "col_new",
    title: "01 INGESTED",
    statuses: ["NEW"],
    icon: Inbox,
    accentColor: "text-[#506361]",
    desc: "Ingested payment declines",
  },
  {
    id: "col_diagnosed",
    title: "02 DIAGNOSED",
    statuses: ["DIAGNOSED"],
    icon: Stethoscope,
    accentColor: "text-[#1C889E]",
    desc: "Root cause classified",
  },
  {
    id: "col_intervening",
    title: "03 INTERVENING",
    statuses: ["INTERVENING"],
    icon: Zap,
    accentColor: "text-[#F38630]",
    desc: "Active rail retry or concession",
  },
  {
    id: "col_recovered",
    title: "04 RECOVERED",
    statuses: ["RECOVERED"],
    icon: CheckCircle,
    accentColor: "text-[#267571]",
    desc: "Captured on Razorpay",
  },
  {
    id: "col_lost",
    title: "05 LOST / ESCALATED",
    statuses: ["LOST", "ESCALATED"],
    icon: AlertTriangle,
    accentColor: "text-[#A34731]",
    desc: "Exhausted or human triage",
  },
];

export const TriageBoard: React.FC<TriageBoardProps> = ({
  cases,
  onAdvanceCase,
  onResolveCase,
  onSelectCase,
  processingId,
}) => {
  return (
    <div className="flex gap-4 h-full min-h-[650px] overflow-x-auto pb-4">
      {COLUMNS.map((col) => {
        const colCases = cases.filter((c) => col.statuses.includes(c.status));
        const colTotalINR = colCases.reduce(
          (sum, c) =>
            sum +
            (c.recovered_amount_paise > 0 ? c.recovered_amount_paise : c.amount_paise) / 100,
          0
        );
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            id={`triage-column-${col.id}`}
            className="flex flex-col bg-[#FFFFFF] border border-[#CAD4C5] rounded-xl p-3.5 space-y-3.5 w-[330px] shrink-0 shadow-xs"
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#CAD4C5]">
              <div className="flex items-center space-x-2">
                <Icon className={`w-4 h-4 ${col.accentColor}`} />
                <div>
                  <h3 className="font-dispatch text-sm font-bold tracking-wider text-[#182628] uppercase">
                    {col.title}
                  </h3>
                  <p className="font-sans text-[11px] text-[#506361]">{col.desc}</p>
                </div>
              </div>

              <div className="text-right">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E0E4CC] border border-[#CAD4C5] text-[#182628]">
                  {colCases.length}
                </span>
                <div className="font-mono text-[10px] text-[#506361] mt-0.5">
                  ₹{colTotalINR.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Cases Card List */}
            <div className="flex-1 space-y-3 overflow-y-auto pr-0.5">
              <AnimatePresence mode="popLayout">
                {colCases.map((caseItem) => (
                  <TriageCaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onAdvance={onAdvanceCase}
                    onResolve={onResolveCase}
                    onSelectCase={onSelectCase}
                    isProcessing={processingId === caseItem.id}
                  />
                ))}
              </AnimatePresence>

              {colCases.length === 0 && (
                <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#CAD4C5] rounded-xl bg-[#E0E4CC]/20">
                  <span className="font-dispatch text-xs font-bold tracking-wider text-[#506361] uppercase">
                    No cases in {col.title.slice(3)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

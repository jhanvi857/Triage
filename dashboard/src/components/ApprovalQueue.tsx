"use client";

import React, { useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { ApprovalItem } from "../lib/types";

interface ApprovalQueueProps {
  approvals: ApprovalItem[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({ approvals, onApprove, onReject }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setLoadingId(id);
    try {
      if (action === "approve") {
        await onApprove(id);
      } else {
        await onReject(id);
      }
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-surface border border-surface-border flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-surface-border">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Human Approval Queue</h2>
              {approvals.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                  {approvals.length} PENDING
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400">Transactions &ge; ₹5,000 threshold requiring authorization</p>
          </div>
        </div>

        {/* List of Pending Items */}
        {approvals.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-lg bg-zinc-900/30">
            <Clock className="w-6 h-6 text-zinc-600 mb-1.5" />
            <p className="text-xs font-medium text-zinc-400">Queue is clear</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Purchases below ₹5,000 are approved autonomously by Ledger rules.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {approvals.map((app) => (
              <div
                key={app.id}
                id={`approval-card-${app.id}`}
                className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-700/80"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white font-mono">
                        ₹{(app.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40">
                        {app.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      Agent: <span className="text-zinc-300 font-semibold">{app.agent_id}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(app.created_at).toLocaleTimeString()}
                  </span>
                </div>

                {/* Reason description */}
                <div className="mt-2 text-[11px] text-zinc-300 bg-zinc-950/60 p-2 rounded border border-zinc-800">
                  <span className="text-zinc-500 font-mono uppercase text-[9px] block">Trigger Reason</span>
                  {app.reason}
                </div>

                {/* Clean Action Buttons */}
                <div className="mt-3 flex items-center space-x-2">
                  <button
                    id={`btn-approve-${app.id}`}
                    onClick={() => handleAction(app.id, "approve")}
                    disabled={loadingId === app.id}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Authorize Razorpay</span>
                  </button>
                  <button
                    id={`btn-reject-${app.id}`}
                    onClick={() => handleAction(app.id, "reject")}
                    disabled={loadingId === app.id}
                    className="flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-md bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Deny</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-surface-border text-[11px] text-zinc-400 flex items-center justify-between font-mono">
        <span>Policy: &ge; ₹5,000 threshold</span>
        <span>Auto-refunds reservation on deny</span>
      </div>
    </div>
  );
};

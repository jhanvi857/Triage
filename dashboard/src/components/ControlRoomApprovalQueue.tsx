"use client";

import React, { useState } from "react";
import { Check, X, Clock, AlertTriangle, ShieldCheck, ShoppingCart } from "lucide-react";
import { ApprovalItem, ProductItem } from "../lib/types";

interface ControlRoomApprovalQueueProps {
  approvals: ApprovalItem[];
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  products: ProductItem[];
}

export const ControlRoomApprovalQueue: React.FC<ControlRoomApprovalQueueProps> = ({
  approvals,
  onApprove,
  onReject,
  products,
}) => {
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
    <div className="flex flex-col h-full bg-[#131720] border border-[#1E2638] rounded-lg p-4 space-y-4">
      {/* Pending Approvals Section */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2638] mb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
            <div>
              <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-[#E4E7EB]">
                Approval Queue
              </h2>
              <p className="text-[10px] text-zinc-400">High-value transactions &ge; ₹5,000</p>
            </div>
          </div>
          {approvals.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40 animate-pulse">
              {approvals.length} PENDING
            </span>
          )}
        </div>

        {/* Approvals List */}
        <div className="space-y-2.5 overflow-y-auto max-h-64 pr-0.5">
          {approvals.length === 0 ? (
            <div className="h-36 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#1E2638] rounded-lg bg-[#0E121B]">
              <Clock className="w-5 h-5 text-zinc-600 mb-1" />
              <p className="text-xs font-mono text-zinc-400">No Gated Items Pending</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                Purchases below ₹5,000 pass autonomously.
              </p>
            </div>
          ) : (
            approvals.map((app) => (
              <div
                key={app.id}
                id={`approval-card-${app.id}`}
                className="p-3 rounded-lg bg-[#0E121B] border border-[#F5A623]/40 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-mono font-black text-white">
                        ₹{(app.amount_paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40">
                        PENDING
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                      Agent: <strong className="text-zinc-300 font-semibold">{app.agent_id}</strong>
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {new Date(app.created_at).toLocaleTimeString()}
                  </span>
                </div>

                <div className="text-[10px] text-zinc-300 bg-[#0B0E14] p-2 rounded border border-[#1E2638]">
                  <span className="text-zinc-500 font-mono uppercase text-[9px] block">Trigger Reason</span>
                  {app.reason}
                </div>

                {/* 1-Click Action Buttons */}
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    id={`btn-approve-${app.id}`}
                    onClick={() => handleAction(app.id, "approve")}
                    disabled={loadingId === app.id}
                    className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 rounded bg-[#34D399] hover:bg-[#34D399]/90 text-[#0B0E14] text-[11px] font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve (Razorpay)</span>
                  </button>
                  <button
                    id={`btn-reject-${app.id}`}
                    onClick={() => handleAction(app.id, "reject")}
                    disabled={loadingId === app.id}
                    className="flex items-center justify-center space-x-1 py-1.5 px-2.5 rounded bg-[#131720] border border-[#F04F4F]/40 text-[#F04F4F] hover:bg-[#F04F4F]/10 text-[11px] font-mono font-medium transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Deny</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Catalog & Policy Reference Table */}
      <div className="pt-3 border-t border-[#1E2638]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5 text-xs font-mono uppercase font-bold text-[#E4E7EB]">
            <ShoppingCart className="w-3.5 h-3.5 text-[#4C8DFF]" />
            <span>Catalog Reference</span>
          </div>
          <span className="text-[9px] font-mono text-zinc-500">Catalog SKUs</span>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono">
          {products.slice(0, 5).map((p) => {
            const inr = p.price_paise / 100;
            let statusTag = "Auto OK";
            let tagColor = "text-[#34D399] bg-[#34D399]/10 border-[#34D399]/30";
            if (inr >= 10000) {
              statusTag = "Over Cap";
              tagColor = "text-[#F04F4F] bg-[#F04F4F]/10 border-[#F04F4F]/30";
            } else if (inr >= 5000) {
              statusTag = "Gated";
              tagColor = "text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/30";
            }

            return (
              <div
                key={p.id}
                className="p-2 rounded bg-[#0E121B] border border-[#1E2638] flex items-center justify-between"
              >
                <div className="truncate mr-2">
                  <div className="text-zinc-300 font-semibold truncate text-[11px]">{p.name}</div>
                  <div className="text-[9px] text-zinc-500 truncate">{p.category}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-white font-mono">₹{inr.toLocaleString("en-IN")}</div>
                  <span className={`text-[8px] font-mono px-1 py-0.2 rounded border uppercase font-medium ${tagColor}`}>
                    {statusTag}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

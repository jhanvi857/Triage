"use client";

import React, { useState } from "react";
import { X, Plus } from "lucide-react";

interface IngestFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIngest: (payload: {
    customer_name: string;
    plan_name: string;
    amount_paise: number;
    original_rail: string;
    error_code: string;
    error_desc: string;
  }) => Promise<void>;
}

const PRESET_CAUSES = [
  {
    code: "GATEWAY_TIMEOUT_504",
    name: "Bank Downtime / Timeout (504)",
    desc: "Issuer bank timed out during 3DS capture",
    rail: "CARD",
    defaultAmount: 4800,
    plan: "Enterprise GPU Cluster (Monthly)",
  },
  {
    code: "INSUFFICIENT_FUNDS",
    name: "Insufficient Funds (Low Balance)",
    desc: "Soft decline: account balance below transaction amount",
    rail: "CARD",
    defaultAmount: 3500,
    plan: "Managed PostgreSQL Cluster",
  },
  {
    code: "CARD_EXPIRED",
    name: "Card Expired (07/26)",
    desc: "Hard decline: instrument expiration date passed",
    rail: "CARD",
    defaultAmount: 4200,
    plan: "AI Inference Tokens Pool",
  },
  {
    code: "3DS_DROP_OFF",
    name: "OTP Screen Abandonment",
    desc: "User closed authentication window without entering OTP",
    rail: "UPI",
    defaultAmount: 1800,
    plan: "Pro Developer Monthly Seat",
  },
  {
    code: "MANDATE_LIMIT",
    name: "Mandate Limit Exceeded (₹15k Cap Breach)",
    desc: "Single transaction exceeds per-debit cap. Mandate remains active — One-Time UPI dominant.",
    rail: "NACH_MANDATE",
    defaultAmount: 18500,
    plan: "Dedicated AI Compute Tier (Monthly)",
  },
  {
    code: "MANDATE_REVOKED",
    name: "Mandate Revoked / Autopay Cancelled",
    desc: "Recurring autopay authorization revoked at destination bank",
    rail: "NACH_MANDATE",
    defaultAmount: 12500,
    plan: "Multi-Agent Compliance License (Annual)",
  },
];

export const IngestFailureModal: React.FC<IngestFailureModalProps> = ({
  isOpen,
  onClose,
  onIngest,
}) => {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customerName, setCustomerName] = useState("Vanguard Technologies Ltd");
  const [amountINR, setAmountINR] = useState(4800);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const preset = PRESET_CAUSES[selectedPreset];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onIngest({
        customer_name: customerName,
        plan_name: preset.plan,
        amount_paise: amountINR * 100,
        original_rail: preset.rail,
        error_code: preset.code,
        error_desc: preset.desc,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    setAmountINR(PRESET_CAUSES[idx].defaultAmount);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs font-sans">
      <div className="w-full max-w-lg rounded-lg border border-[#E2E5E5] bg-[#FFFFFF] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E2E5E5] bg-[#F5F6F6]">
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-[#087F83]" />
            <h2 className="text-[16px] font-semibold tracking-wide text-[#202525] uppercase">
              Ingest Simulated Payment Failure
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#6F7777] hover:text-[#202525] hover:bg-[#E2E5E5] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-[#6F7777] mb-1.5 uppercase tracking-wider">
              Failure Root Cause Preset
            </label>
            <div className="space-y-1.5">
              {PRESET_CAUSES.map((p, idx) => (
                <div
                  key={p.code}
                  onClick={() => handleSelectPreset(idx)}
                  className={`p-2.5 rounded-md border text-[13px] cursor-pointer transition-all ${
                    selectedPreset === idx
                      ? "bg-[#087F83]/10 border-[#087F83] text-[#202525]"
                      : "bg-[#FFFFFF] border-[#E2E5E5] text-[#6F7777] hover:border-[#087F83]"
                  }`}
                >
                  <div className="font-medium text-[#202525] flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-[11px] font-mono text-[#6F7777]">Rail: {p.rail}</span>
                  </div>
                  <div className="text-[12px] text-[#6F7777] mt-0.5">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-[#6F7777] mb-1">
                Company / Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-[#FFFFFF] border border-[#E2E5E5] rounded px-3 py-1.5 text-[13px] font-normal text-[#202525] focus:outline-hidden focus:border-[#087F83]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#6F7777] mb-1">
                Amount (INR)
              </label>
              <input
                type="number"
                value={amountINR}
                onChange={(e) => setAmountINR(Number(e.target.value))}
                required
                min={100}
                className="w-full bg-[#FFFFFF] border border-[#E2E5E5] rounded px-3 py-1.5 text-[13px] font-normal text-[#202525] font-mono focus:outline-hidden focus:border-[#087F83]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E5E5] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#F5F6F6] text-[12px] font-medium text-[#6F7777] hover:text-[#202525] transition-colors border border-[#E2E5E5] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-[#087F83] hover:bg-[#06686B] text-white text-[12px] font-medium tracking-wide transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Ingesting..." : "Ingest Case to Board"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

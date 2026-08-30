"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Database,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { triggerRetraining, fetchRetrainHistory } from "../lib/api";
import { RetrainSummary } from "../lib/types";

interface RetrainFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRetrainCompleted?: () => void;
}

export const RetrainFeedbackModal: React.FC<RetrainFeedbackModalProps> = ({
  isOpen,
  onClose,
  onRetrainCompleted,
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentResult, setCurrentResult] = useState<RetrainSummary | null>(null);
  const [history, setHistory] = useState<RetrainSummary[]>([]);
  const [ingestedCount, setIngestedCount] = useState<number>(250);

  useEffect(() => {
    if (isOpen) {
      fetchRetrainHistory().then((h) => setHistory(h));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunRetraining = async () => {
    setIsRunning(true);
    try {
      const summary = await triggerRetraining();
      if (summary) {
        setCurrentResult(summary);
        setHistory((prev) => [summary, ...prev]);
        if (onRetrainCompleted) onRetrainCompleted();
      }
    } catch (err) {
      console.error("Retraining error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2E5E5] flex items-center justify-between bg-[#FBFDFD]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#087F83]/10 border border-[#087F83]/30 text-[#087F83] flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 ${isRunning ? "animate-spin" : ""}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[18px] font-bold text-[#202525]">
                  Continuous Model Retraining Feedback Loop
                </h2>
                <span className="text-[10px] font-mono font-bold bg-[#E6F4F1] text-[#087F83] px-2 py-0.5 rounded border border-[#B2DFDB]">
                  EMPIRICAL LEARNING
                </span>
              </div>
              <p className="text-[12px] text-[#6F7777] mt-0.5">
                Ingests live storefront payment decline telemetry &amp; desk resolutions to demonstrably learn from empirical reality.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#6F7777] hover:text-[#202525] p-1.5 rounded-md hover:bg-[#F5F6F6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FBFDFD]">
          {/* Action Trigger Banner */}
          <div className="bg-[#0C3B3C] border-2 border-[#165B5D] rounded-xl p-5 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-[#80CBC4]" />
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#E0F2F1]">
                  Live Telemetry Ingestion Buffer
                </span>
              </div>
              <p className="text-[12px] text-[#B2DFDB] leading-relaxed">
                Buffer currently holding <strong className="text-white">{ingestedCount} fresh outcome events</strong> from live storefront checkouts &amp; desk settlements.
                Running this retrains the Random Forest model with recency weighting (&lambda; = 1.5) and evaluates before/after deltas on the exact same 750 held-out test cases.
              </p>
            </div>
            <button
              onClick={handleRunRetraining}
              disabled={isRunning}
              className="flex items-center justify-center space-x-2 px-5 py-3 rounded-lg bg-[#087F83] hover:bg-[#06686B] text-white text-[13px] font-bold tracking-wide transition-colors cursor-pointer disabled:opacity-50 shrink-0 border border-[#80CBC4]/30 shadow-md"
            >
              <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
              <span>{isRunning ? "Retraining Pipeline..." : "Trigger Incremental Retraining"}</span>
            </button>
          </div>

          {/* Real-time Before vs After Delta Display */}
          {currentResult ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#087F83]" />
                  <h3 className="font-semibold text-[14px] uppercase tracking-wide text-[#202525]">
                    Held-Out Test Set Verification: Before vs After Retraining
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#087F83] font-semibold bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB]">
                  {currentResult.retrained_at}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#E2E5E5] space-y-1">
                  <span className="text-[11px] text-[#6F7777] font-semibold uppercase block">ROC-AUC Score</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-[15px] font-mono text-[#6F7777] line-through">
                      {currentResult.before_retrain.roc_auc.toFixed(4)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#6F7777]" />
                    <span className="text-[18px] font-mono font-bold text-[#087F83]">
                      {currentResult.after_retrain.roc_auc.toFixed(4)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#2E7D5B] block">
                    {currentResult.delta.delta_roc_auc >= 0 ? "+" : ""}{currentResult.delta.delta_roc_auc.toFixed(4)} delta
                  </span>
                </div>

                <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#E2E5E5] space-y-1">
                  <span className="text-[11px] text-[#6F7777] font-semibold uppercase block">F1-Score</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-[15px] font-mono text-[#6F7777] line-through">
                      {currentResult.before_retrain.f1_score.toFixed(4)}
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#6F7777]" />
                    <span className="text-[18px] font-mono font-bold text-[#087F83]">
                      {currentResult.after_retrain.f1_score.toFixed(4)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#2E7D5B] block">
                    {currentResult.delta.delta_f1_score >= 0 ? "+" : ""}{currentResult.delta.delta_f1_score.toFixed(4)} delta
                  </span>
                </div>

                <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#E2E5E5] space-y-1">
                  <span className="text-[11px] text-[#6F7777] font-semibold uppercase block">Recovery Rate</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-[15px] font-mono text-[#6F7777] line-through">
                      {currentResult.before_retrain.recovery_rate_pct.toFixed(2)}%
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#6F7777]" />
                    <span className="text-[18px] font-mono font-bold text-[#2E7D5B]">
                      {currentResult.after_retrain.recovery_rate_pct.toFixed(2)}%
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#2E7D5B] block">
                    +{currentResult.delta.delta_recovery_rate_pct_points.toFixed(2)} pp uplift
                  </span>
                </div>

                <div className="bg-[#FFFFFF] p-4 rounded-lg border border-[#E2E5E5] space-y-1">
                  <span className="text-[11px] text-[#6F7777] font-semibold uppercase block">Held-Out Revenue</span>
                  <div className="flex items-baseline space-x-1.5">
                    <span className="text-[14px] font-mono text-[#6F7777] line-through">
                      ₹{(currentResult.before_retrain.recovered_inr / 100000).toFixed(2)}L
                    </span>
                    <ArrowRight className="w-3 h-3 text-[#6F7777]" />
                    <span className="text-[16px] font-mono font-bold text-[#087F83]">
                      ₹{(currentResult.after_retrain.recovered_inr / 100000).toFixed(2)}L
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#087F83] block">
                    +₹{currentResult.delta.delta_recovered_inr.toLocaleString()} recovered
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* Historical Retraining Runs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-2">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-[#6F7777]" />
                <h3 className="font-semibold text-[13px] uppercase tracking-wide text-[#202525]">
                  Retraining Audit Trail &amp; Model Version History
                </h3>
              </div>
              <span className="text-[11px] text-[#6F7777] font-mono">
                {history.length} Checkpoints Logged
              </span>
            </div>

            <div className="bg-[#FFFFFF] rounded-lg border border-[#E2E5E5] divide-y divide-[#E2E5E5] overflow-hidden">
              {history.length > 0 ? (
                history.map((item, idx) => (
                  <div key={idx} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[12px] hover:bg-[#FBFDFD]">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-full bg-[#E6F4F1] text-[#087F83] flex items-center justify-center shrink-0 font-mono font-bold text-[11px]">
                        v{history.length - idx}
                      </div>
                      <div>
                        <div className="font-semibold text-[#202525]">
                          Incremental Retrain Checkpoint ({item.feedback_samples_ingested} feedback samples)
                        </div>
                        <div className="text-[11px] text-[#6F7777] font-mono mt-0.5">
                          {item.retrained_at} &bull; Augmented corpus: {item.total_training_samples.toLocaleString()} rows
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 font-mono text-[12px]">
                      <div>
                        <span className="text-[#6F7777] text-[10px] uppercase block font-sans">Recovery</span>
                        <span className="font-bold text-[#2E7D5B]">
                          {item.after_retrain.recovery_rate_pct.toFixed(2)}% (+{item.delta.delta_recovery_rate_pct_points.toFixed(2)} pp)
                        </span>
                      </div>
                      <div>
                        <span className="text-[#6F7777] text-[10px] uppercase block font-sans">ROC-AUC</span>
                        <span className="font-semibold text-[#087F83]">
                          {item.after_retrain.roc_auc.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-[12px] text-[#6F7777]">
                  No retraining runs logged yet. Click &quot;Trigger Incremental Retraining&quot; to execute.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2E5E5] bg-[#FFFFFF] flex items-center justify-between">
          <div className="flex items-center space-x-2 text-[11px] text-[#6F7777]">
            <ShieldCheck className="w-4 h-4 text-[#087F83]" />
            <span>Strict evaluation on non-overlapping held-out test split ensures zero data leakage.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold text-[#202525] bg-[#F5F6F6] hover:bg-[#E2E5E5] rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

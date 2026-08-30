"use client";

import React from "react";
import {
  X,
  Compass,
  ShieldCheck,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Layers,
  ArrowRight,
} from "lucide-react";
import { ShadowBanditReport } from "../lib/types";

interface ShadowBanditModalProps {
  isOpen: boolean;
  onClose: () => void;
  report?: ShadowBanditReport;
  caseId?: string;
}

export const ShadowBanditModal: React.FC<ShadowBanditModalProps> = ({
  isOpen,
  onClose,
  report,
  caseId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E2E5E5] flex items-center justify-between bg-[#FBFDFD]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#087F83]/10 border border-[#087F83]/30 text-[#087F83] flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-[#202525]">
                  Shadow-Mode Contextual Bandit Exploration
                </h2>
                <span className="text-[10px] font-mono font-bold bg-[#E6F4F1] text-[#087F83] px-2 py-0.5 rounded border border-[#B2DFDB]">
                  OBSERVATION ONLY
                </span>
              </div>
              <p className="text-[12px] text-[#6F7777] mt-0.5 font-mono">
                {caseId ? `Case: ${caseId}` : "Contextual LinUCB / Multi-Armed Exploration"}
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#FBFDFD]">
          {/* Zero Live Execution Risk Guarantee Callout */}
          <div className="bg-[#0C3B3C] border-2 border-[#165B5D] rounded-xl p-4 text-white flex items-start space-x-3 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-[#80CBC4] shrink-0 mt-0.5" />
            <div className="space-y-1 text-[12px]">
              <span className="font-bold uppercase tracking-wide text-[#E0F2F1] block">
                Zero Financial Execution Risk Guarantee
              </span>
              <p className="text-[#B2DFDB] leading-relaxed">
                The Contextual Bandit runs strictly in <strong>shadow observation mode</strong>. It logs counterfactual choices to evaluate exploration-exploitation trade-offs but <strong>never executes payments or customer communications</strong>. Production execution remains 100% governed by the deterministic policy engine.
              </p>
            </div>
          </div>

          {report ? (
            <div className="space-y-4">
              {/* Production Choice vs Shadow Choice Comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#6F7777] uppercase font-mono">
                      Production Decision (Executed)
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#2E7D5B]" />
                  </div>
                  <div className="font-mono font-bold text-[15px] text-[#202525]">
                    {report.production_action}
                  </div>
                  <span className="text-[11px] font-mono text-[#2E7D5B] block font-semibold">
                    EV: ₹{report.production_ev_inr.toFixed(2)} (Pure Exploitation)
                  </span>
                </div>

                <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#087F83] uppercase font-mono">
                      Shadow Bandit Recommendation
                    </span>
                    <Compass className="w-4 h-4 text-[#087F83]" />
                  </div>
                  <div className="font-mono font-bold text-[15px] text-[#087F83]">
                    {report.shadow_action}
                  </div>
                  <span className="text-[11px] font-mono text-[#087F83] block font-semibold">
                    EV: ₹{report.shadow_ev_inr.toFixed(2)} (Exploration Score)
                  </span>
                </div>
              </div>

              {/* Exploration Rationale */}
              <div className="p-4 rounded-lg bg-[#FFFFFF] border border-[#E2E5E5] space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F7777] font-mono block">
                  Bandit Decision Explanation
                </span>
                <p className="text-[12px] text-[#202525] leading-relaxed">
                  {report.exploration_reason}
                </p>
                {report.estimated_opportunity_cost_inr > 0 ? (
                  <div className="text-[11px] font-mono text-[#B7791F] pt-1">
                    Estimated counterfactual opportunity cost: ₹{report.estimated_opportunity_cost_inr.toFixed(2)}
                  </div>
                ) : (
                  <div className="text-[11px] font-mono text-[#2E7D5B] pt-1">
                    Zero opportunity cost &bull; Bandit and Production model aligned on optimal action.
                  </div>
                )}
              </div>

              {/* Arm Evaluations Table if present */}
              {report.arm_evaluations && report.arm_evaluations.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#6F7777] font-mono block">
                    Contextual UCB Arm Scores
                  </span>
                  <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-[#F5F6F6] text-[#6F7777] border-b border-[#E2E5E5]">
                        <tr>
                          <th className="py-2 px-3">Candidate Arm</th>
                          <th className="py-2 px-3 text-right">ML Prob</th>
                          <th className="py-2 px-3 text-right">Base EV</th>
                          <th className="py-2 px-3 text-right">Explore Bonus</th>
                          <th className="py-2 px-3 text-right">UCB Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E5E5]">
                        {report.arm_evaluations.map((arm, idx) => (
                          <tr key={idx} className={arm.action === report.shadow_action ? "bg-[#E6F4F1]/40" : ""}>
                            <td className="py-2 px-3 font-semibold text-[#202525]">
                              {arm.action}
                              {arm.action === report.shadow_action && (
                                <span className="ml-1.5 text-[9px] text-[#087F83] font-bold bg-[#E6F4F1] px-1.5 py-0.5 rounded border border-[#B2DFDB]">
                                  BANDIT CHOICE
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">{(arm.ml_probability * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right">₹{arm.expected_value_inr.toFixed(2)}</td>
                            <td className="py-2 px-3 text-right text-[#087F83]">+{((arm.exploration_bonus) * 100).toFixed(1)}%</td>
                            <td className="py-2 px-3 text-right font-bold text-[#202525]">₹{arm.ucb_score.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-[12px] text-[#6F7777]">
              No shadow bandit telemetry available for this case.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E2E5E5] bg-[#FFFFFF] flex justify-end">
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

"use client";

import React, { useState, useEffect } from "react";
import {
  GitCommit,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Play,
  Layers,
  Sparkles,
} from "lucide-react";
import { RecoveryPlan, PlanStep } from "../lib/types";
import { fetchCasePlan, triggerSchedulerStep } from "../lib/api";

interface RecoveryPlanViewProps {
  caseId: string;
  onStepExecuted?: () => void;
}

export const RecoveryPlanView: React.FC<RecoveryPlanViewProps> = ({
  caseId,
  onStepExecuted,
}) => {
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  const loadPlan = async () => {
    setIsLoading(true);
    try {
      const res = await fetchCasePlan(caseId);
      if (res && res.recovery_plan) {
        setPlan(res.recovery_plan);
      }
    } catch (err) {
      console.error("fetchCasePlan error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) loadPlan();
  }, [caseId]);

  const handleTriggerStep = async () => {
    setIsExecuting(true);
    try {
      await triggerSchedulerStep(caseId);
      await loadPlan();
      if (onStepExecuted) onStepExecuted();
    } catch (err) {
      console.error("Trigger step error:", err);
    } finally {
      setIsExecuting(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-xs text-[#6F7777]">Loading bounded recovery plan...</div>;
  }

  if (!plan) {
    return (
      <div className="p-4 text-xs text-[#6F7777] bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg">
        No bounded recovery plan generated for this case yet.
      </div>
    );
  }

  return (
    <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-5 space-y-4 font-sans shadow-xs">
      <div className="flex items-center justify-between border-b border-[#E2E5E5] pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#B2DFDB]">
              BOUNDED RECOVERY WORKFLOW PLANNER
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
              plan.status === "COMPLETED"
                ? "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]"
                : plan.status === "STOPPED" || plan.status === "MARK_LOST_EXHAUSTED"
                ? "bg-[#FFEBEE] text-[#C93B2B] border-[#FFCDD2]"
                : plan.status === "ESCALATED"
                ? "bg-[#FFF8E1] text-[#F57F17] border-[#FFE082]"
                : "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB]"
            }`}>
              STATUS: {plan.status}
            </span>
          </div>
          <h3 className="text-sm font-bold text-[#202525] mt-1">
            Deterministic Recovery State Machine ({plan.steps.length} Bounded Steps)
          </h3>
        </div>

        {plan.status === "ACTIVE" && (
          <button
            onClick={handleTriggerStep}
            disabled={isExecuting}
            className="px-3 py-1.5 bg-[#087F83] hover:bg-[#066B6E] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {isExecuting ? "Executing Step..." : "Trigger Due Step"}
          </button>
        )}
      </div>

      {/* Step Progression Timeline */}
      <div className="space-y-3">
        {plan.steps.map((step, idx) => {
          const isCurrent = idx === plan.current_step_index && plan.status === "ACTIVE";
          const isSuccess = step.status === "SUCCESS";
          const isFailure = step.status === "FAILURE";
          const isSkipped = step.status === "SKIPPED";
          const isPending = step.status === "PENDING";

          return (
            <div
              key={step.step_index}
              className={`p-3.5 rounded-lg border transition-all ${
                isCurrent
                  ? "bg-[#E6F4F1]/70 border-[#087F83] ring-1 ring-[#087F83]/30"
                  : isSuccess
                  ? "bg-[#E8F5E9]/50 border-[#C8E6C9]"
                  : isFailure
                  ? "bg-[#FFEBEE]/40 border-[#FFCDD2]"
                  : isSkipped
                  ? "bg-[#F5F6F6] border-[#E2E5E5] opacity-60"
                  : "bg-[#FFFFFF] border-[#E2E5E5]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-mono font-bold ${
                    isSuccess
                      ? "bg-[#2E7D32] text-white"
                      : isFailure
                      ? "bg-[#C93B2B] text-white"
                      : isCurrent
                      ? "bg-[#087F83] text-white animate-pulse"
                      : "bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]"
                  }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#202525] flex items-center gap-2">
                      <span>{step.action}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold uppercase text-[#087F83] bg-[#E6F4F1] px-1.5 py-0.2 rounded border border-[#B2DFDB]">
                          NEXT DUE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[#6F7777] mt-0.5">
                      Scheduled: {new Date(step.scheduled_at).toLocaleString()} {step.cooldown_duration && `(Gap: ${step.cooldown_duration})`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                    isSuccess
                      ? "bg-[#E8F5E9] text-[#2E7D32] border-[#C8E6C9]"
                      : isFailure
                      ? "bg-[#FFEBEE] text-[#C93B2B] border-[#FFCDD2]"
                      : isCurrent
                      ? "bg-[#E6F4F1] text-[#087F83] border-[#B2DFDB]"
                      : "bg-[#F5F6F6] text-[#6F7777] border-[#E2E5E5]"
                  }`}>
                    {step.status}
                  </span>
                  {step.result && (
                    <div className="text-[10px] text-[#6F7777] font-mono mt-0.5">
                      Result: {step.result}
                    </div>
                  )}
                </div>
              </div>

              {/* Branch Transitions Indicator */}
              <div className="mt-2 pt-2 border-t border-[#E2E5E5]/60 flex items-center justify-between text-[10px] font-mono text-[#6F7777]">
                <div>
                  <span className="text-[#2E7D32] font-semibold">On Success:</span> {step.success_transition}
                </div>
                <div>
                  <span className="text-[#C93B2B] font-semibold">On Failure:</span> {step.failure_transition}
                </div>
                <div>
                  <span className="text-[#6F7777]">Idempotency:</span> {step.idempotency_key}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-2.5 bg-[#F9FAFA] border border-[#E2E5E5] rounded-lg text-[11px] text-[#6F7777] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#087F83] shrink-0" />
        <span>
          <strong>Bounded Termination Guarantee:</strong> Every recovery sequence terminates in at most {plan.max_steps} steps with strict stop conditions (fraud detection, 3-attempt ceiling). No infinite loops.
        </span>
      </div>
    </div>
  );
};

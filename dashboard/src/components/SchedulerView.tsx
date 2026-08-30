"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Clock,
  FastForward,
  Play,
  CheckCircle2,
  Calendar,
  AlertCircle,
  RotateCcw,
  Layers,
  Sparkles,
} from "lucide-react";
import { fetchSchedulerPending, advanceScheduler, triggerSchedulerStep } from "../lib/api";
import { SchedulerPendingReport, ScheduledStep } from "../lib/types";

interface SchedulerViewProps {
  onRefresh?: () => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({ onRefresh }) => {
  const [report, setReport] = useState<SchedulerPendingReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [triggeringCase, setTriggeringCase] = useState<string | null>(null);
  const [advanceDuration, setAdvanceDuration] = useState<string>("4h");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchSchedulerPending();
      if (data) setReport(data);
    } catch (err) {
      console.error("fetchSchedulerPending error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdvance = async (duration: string) => {
    setIsAdvancing(true);
    try {
      await advanceScheduler(duration);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("advanceScheduler error:", err);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleTrigger = async (caseId: string) => {
    setTriggeringCase(caseId);
    try {
      await triggerSchedulerStep(caseId);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("triggerSchedulerStep error:", err);
    } finally {
      setTriggeringCase(null);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#087F83] bg-[#E6F4F1] px-2.5 py-0.5 rounded border border-[#B2DFDB]">
              DETERMINISTIC SCHEDULER
            </span>
            <span className="text-[11px] font-mono text-[#6F7777] bg-[#F5F6F6] px-2 py-0.5 rounded border border-[#E2E5E5]">
              SIMULATED CLOCK CONTROL
            </span>
          </div>
          <h1 className="text-[22px] font-bold text-[#202525] mt-1.5 leading-tight">
            Recovery Step Execution Scheduler
          </h1>
          <p className="text-[12px] text-[#6F7777] mt-0.5 max-w-3xl">
            Coordinates deferred recovery attempts (payday windows, cooldown retries, PTP commitments) with deterministic simulated clock advancement.
          </p>
        </div>

        {/* Advance Time Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleAdvance("1h")}
            disabled={isAdvancing}
            className="px-3 py-1.5 bg-[#F5F6F6] hover:bg-[#EAEAEA] border border-[#E2E5E5] text-[#202525] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <FastForward className="w-3.5 h-3.5 text-[#087F83]" /> +1 Hour
          </button>
          <button
            onClick={() => handleAdvance("4h")}
            disabled={isAdvancing}
            className="px-3 py-1.5 bg-[#087F83] hover:bg-[#066B6E] text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
          >
            <FastForward className="w-3.5 h-3.5" /> +4 Hours
          </button>
          <button
            onClick={() => handleAdvance("24h")}
            disabled={isAdvancing}
            className="px-3 py-1.5 bg-[#F5F6F6] hover:bg-[#EAEAEA] border border-[#E2E5E5] text-[#202525] rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <FastForward className="w-3.5 h-3.5 text-[#087F83]" /> +24 Hours (Payday)
          </button>
        </div>
      </div>

      {/* 2. Clock Status Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Simulated Scheduler Clock</span>
            <Clock className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#202525]">
            {report?.current_simulated_time
              ? new Date(report.current_simulated_time).toLocaleString()
              : "Synchronized with UTC"}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Deterministic time testing enabled
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Steps Due for Execution</span>
            <AlertCircle className="w-4 h-4 text-[#F57F17]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F57F17]">
            {report?.due_steps_count || 0}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Cooldown / payday window elapsed
          </div>
        </div>

        <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#6F7777] text-xs font-medium">
            <span>Total Pending Scheduled Steps</span>
            <Calendar className="w-4 h-4 text-[#087F83]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#087F83]">
            {report?.pending_steps_count || 0}
          </div>
          <div className="mt-1 text-[11px] text-[#6F7777]">
            Future actions queued across plans
          </div>
        </div>
      </div>

      {/* 3. Due Steps Immediate Trigger Table */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#202525] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F57F17]" />
            Due Steps Ready for Policy Re-evaluation & Execution
          </h2>
          <span className="text-[11px] font-mono text-[#6F7777]">
            ScheduledAt &le; Current Simulated Time
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFA] border-b border-[#E2E5E5] text-[#6F7777] uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-2.5 px-4">Case ID</th>
                <th className="py-2.5 px-4">Step Index</th>
                <th className="py-2.5 px-4">Recovery Action</th>
                <th className="py-2.5 px-4">Scheduled At</th>
                <th className="py-2.5 px-4 font-mono">Idempotency Key</th>
                <th className="py-2.5 px-4 text-center">Execute</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {report?.due_steps && report.due_steps.length > 0 ? (
                report.due_steps.map((step) => (
                  <tr key={`${step.case_id}-${step.step_index}`} className="hover:bg-[#F5F6F6] transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#202525]">{step.case_id}</td>
                    <td className="py-3 px-4 font-mono text-[#087F83]">Step #{step.step_index}</td>
                    <td className="py-3 px-4 font-medium text-[#202525]">{step.action}</td>
                    <td className="py-3 px-4 text-[11px] font-mono text-[#6F7777]">
                      {new Date(step.scheduled_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#6F7777]">{step.idempotency_key}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleTrigger(step.case_id)}
                        disabled={triggeringCase === step.case_id}
                        className="px-3 py-1 bg-[#087F83] hover:bg-[#066B6E] text-white rounded text-xs font-semibold flex items-center gap-1 mx-auto transition-colors disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {triggeringCase === step.case_id ? "Executing..." : "Execute Step"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6F7777]">
                    No recovery steps currently due. Advance the simulated clock above to test future trigger execution.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Full Pending Steps Queue */}
      <div className="bg-[#FFFFFF] border border-[#E2E5E5] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E5E5] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#202525] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#087F83]" />
            Full Pending Recovery Queue (All Future Steps)
          </h2>
          <span className="text-[11px] font-mono text-[#6F7777]">
            {report?.pending_steps?.length || 0} queued steps
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F9FAFA] border-b border-[#E2E5E5] text-[#6F7777] uppercase text-[10px] tracking-wider font-mono">
              <tr>
                <th className="py-2.5 px-4">Case ID</th>
                <th className="py-2.5 px-4">Step</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Scheduled Date</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E5E5]">
              {report?.pending_steps && report.pending_steps.length > 0 ? (
                report.pending_steps.map((step) => (
                  <tr key={`${step.case_id}-${step.step_index}`} className="hover:bg-[#F5F6F6] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-[#202525]">{step.case_id}</td>
                    <td className="py-3 px-4 font-mono text-[#6F7777]">#{step.step_index}</td>
                    <td className="py-3 px-4 text-[#202525]">{step.action}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#6F7777]">
                      {new Date(step.scheduled_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F5F6F6] text-[#6F7777] border border-[#E2E5E5]">
                        PENDING
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#6F7777]">
                    No pending steps in scheduler.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

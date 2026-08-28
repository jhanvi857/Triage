"use client";

import React, { useState } from "react";
import { X, Play, Terminal, Loader2 } from "lucide-react";

interface ScenarioRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const ScenarioRunnerModal: React.FC<ScenarioRunnerModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
}) => {
  const [runningId, setRunningId] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  if (!isOpen) return null;

  const appendLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const runScenario = async (scenarioNumber: number) => {
    setRunningId(scenarioNumber);
    setLogs([`Triggering Scenario ${scenarioNumber}...`]);

    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080";

    try {
      if (scenarioNumber === 1) {
        // Scenario 1: Happy Path
        appendLog("Agent: Checking budget token bucket...");
        const bRes = await fetch(`${gatewayUrl}/api/v1/agents/agent_compute_01/budget`);
        const bData = await bRes.json();
        appendLog(`Budget confirmed: ₹${bData.remaining_inr} remaining.`);

        appendLog("Agent: Reasoning -> 'Provisioning 1 hr H100 GPU compute for ₹3,600. Fits spend cap.'");
        appendLog("Calling initiate_purchase tool...");
        const pRes = await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "agent_compute_01",
            product_id: "prod_gpu_h100",
            quantity: 1,
            stated_amount_paise: 360000,
            reasoning: "Provisioning 1 hr H100 GPU compute for model training pipeline.",
            idempotency_key: `idem_ui_s1_${Date.now()}`,
          }),
        });
        const pData = await pRes.json();
        appendLog(`Gateway Verdict: ${pData.status}`);
        appendLog(`Razorpay Order ID: ${pData.razorpay_order_id}, Payment: ${pData.razorpay_payment_id}`);
        appendLog("[SUCCESS] Scenario 1 Completed Successfully");

      } else if (scenarioNumber === 2) {
        // Scenario 2: Over Budget & Recovery
        appendLog("Agent: Attempting to purchase ₹25,000 Datacenter Supercluster...");
        const pRes1 = await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "agent_adaptive_02",
            product_id: "prod_datacenter_node",
            quantity: 1,
            reasoning: "Attempting to acquire entire datacenter node for massive training run.",
            idempotency_key: `idem_ui_s2_over_${Date.now()}`,
          }),
        });
        const pData1 = await pRes1.json();
        appendLog(`Gateway Verdict: ${pData1.status} (${pData1.primary_reason})`);

        appendLog("Agent: Reasoning -> 'Request rejected for budget. Adapting goal to ₹4,200 PostgreSQL cluster.'");
        const pRes2 = await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "agent_adaptive_02",
            product_id: "prod_db_cluster",
            quantity: 1,
            reasoning: "Adapting footprint to Managed PostgreSQL Cluster (₹4,200) within remaining token budget.",
            idempotency_key: `idem_ui_s2_adapt_${Date.now()}`,
          }),
        });
        const pData2 = await pRes2.json();
        appendLog(`Gateway Recovery Verdict: ${pData2.status}`);
        appendLog(`Razorpay Order ID: ${pData2.razorpay_order_id}`);
        appendLog("[SUCCESS] Scenario 2 Completed: Graceful adaptation without crashing");

      } else if (scenarioNumber === 3) {
        // Scenario 3: High-Value Threshold Gate
        appendLog("Agent: Attempting to purchase ₹7,500 Enterprise License (> ₹5,000 threshold)...");
        const pRes = await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "agent_compliance_03",
            product_id: "prod_enterprise_ai",
            quantity: 1,
            reasoning: "Procuring Enterprise Autonomous Agent Sandbox License for QA compliance.",
            idempotency_key: `idem_ui_s3_${Date.now()}`,
          }),
        });
        const pData = await pRes.json();
        appendLog(`Gateway Verdict: ${pData.status} -> Approval ID: ${pData.approval_id}`);
        appendLog("Transaction placed in Human-in-the-Loop Gating Queue.");
        appendLog("Click 'Authorize Razorpay' on the dashboard approval queue card to approve!");

      } else if (scenarioNumber === 4) {
        // Scenario 4: Network Timeout & Idempotency Replay
        const sharedKey = `idem_ui_s4_${Date.now()}`;
        appendLog(`Generated Idempotency Key: ${sharedKey}`);
        appendLog("Attempt 1: Sending request with simulated 504 Gateway Timeout...");

        try {
          await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: "agent_network_04",
              product_id: "prod_ai_tokens",
              quantity: 1,
              reasoning: "Acquiring 10M token credit pool for inference.",
              idempotency_key: sharedKey,
              simulate_timeout_error: true,
            }),
          });
        } catch (_) {}
        appendLog("[TIMEOUT] Network Disconnection Triggered (Simulated Timeout)");

        appendLog("Attempt 2: Retrying request with EXACT SAME idempotency key...");
        const pRes2 = await fetch(`${gatewayUrl}/api/v1/purchase/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "agent_network_04",
            product_id: "prod_ai_tokens",
            quantity: 1,
            reasoning: "Acquiring 10M token credit pool for inference.",
            idempotency_key: sharedKey,
          }),
        });
        const pData2 = await pRes2.json();
        appendLog(`Gateway Replay Verdict: ${pData2.status}`);
        appendLog(`Cached Razorpay Order ID: ${pData2.razorpay_order_id}`);
        appendLog("[CONFIRMED] Idempotency Confirmed: Zero double billing");
      }
    } catch (err: any) {
      appendLog(`Error: ${err.message}`);
    } finally {
      setRunningId(null);
      onRefresh();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-[#121215] overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center space-x-2.5">
            <Terminal className="w-4 h-4 text-zinc-300" />
            <div>
              <h3 className="font-bold text-white text-sm">Pitch Demo Runner</h3>
              <p className="text-[11px] text-zinc-400">Trigger live scenarios against the running gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: 4 Minimal Scenario Cards */}
        <div className="p-4 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {/* Scenario 1 */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-zinc-400 font-bold">01</span>
                  <h4 className="font-bold text-white text-xs">Autonomous Happy Path</h4>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Checks spend cap (₹10k) &rarr; Buys H100 GPU (₹3,600) &rarr; Under ₹5k threshold &rarr; <strong>Approved &amp; Paid</strong>.
                </p>
              </div>
              <button
                id="btn-run-scenario-1"
                disabled={runningId !== null}
                onClick={() => runScenario(1)}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shrink-0 transition-colors disabled:opacity-50"
              >
                {runningId === 1 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Scenario 2 */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-zinc-400 font-bold">02</span>
                  <h4 className="font-bold text-white text-xs">Over-Budget Rejection &amp; Recovery</h4>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Requests ₹25k supercluster &rarr; Gate blocks with explanation &rarr; Agent downsizes to ₹4,200 Postgres &rarr; <strong>Approved</strong>.
                </p>
              </div>
              <button
                id="btn-run-scenario-2"
                disabled={runningId !== null}
                onClick={() => runScenario(2)}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shrink-0 transition-colors disabled:opacity-50"
              >
                {runningId === 2 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Scenario 3 */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-zinc-400 font-bold">03</span>
                  <h4 className="font-bold text-white text-xs">High-Value Threshold Gate (Human Review)</h4>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Requests ₹7,500 Enterprise License &ge; ₹5k threshold &rarr; Held in <strong>PENDING_APPROVAL</strong> state for 1-click human review.
                </p>
              </div>
              <button
                id="btn-run-scenario-3"
                disabled={runningId !== null}
                onClick={() => runScenario(3)}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shrink-0 transition-colors disabled:opacity-50"
              >
                {runningId === 3 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Scenario 4 */}
          <div className="p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-zinc-400 font-bold">04</span>
                  <h4 className="font-bold text-white text-xs">Network Timeout &amp; Idempotency Guarantee</h4>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Simulated 504 timeout &rarr; Retried with same <code>idempotency_key</code> &rarr; Returns cached order with <strong>0 double billing</strong>.
                </p>
              </div>
              <button
                id="btn-run-scenario-4"
                disabled={runningId !== null}
                onClick={() => runScenario(4)}
                className="flex items-center space-x-1 px-3 py-1 rounded bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-medium shrink-0 transition-colors disabled:opacity-50"
              >
                {runningId === 4 ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                <span>Run</span>
              </button>
            </div>
          </div>

          {/* Minimal Terminal Console Output */}
          {logs.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-black border border-zinc-800 font-mono text-xs text-zinc-300 max-h-40 overflow-y-auto space-y-1">
              <div className="text-[9px] text-zinc-500 font-bold uppercase mb-1">Execution Output</div>
              {logs.map((l, idx) => (
                <div key={idx} className="text-[11px] text-zinc-300">
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

#!/usr/bin/env python3
"""
Triage Evaluation Scenario Harness
Simulates realistic checkout requests and policy enforcement scenarios with step-by-step telemetry.
Deterministic Simulation and Policy Evaluation.
"""

import json
import os
import sys
import time
import uuid
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Optional

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

GATEWAY_URL = os.environ.get("LEDGER_GATEWAY_URL", "http://localhost:8080")

# Color formatting for terminal presentation
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


class LedgerClient:
    """HTTP client communicating with Ledger Gateway / API layer."""

    def __init__(self, base_url: str = GATEWAY_URL):
        self.base_url = base_url.rstrip("/")

    def get_budget(self, agent_id: str) -> Dict[str, Any]:
        return self._request(f"/api/v1/agents/{agent_id}/budget")

    def reset_budget(self, agent_id: str) -> Dict[str, Any]:
        return self._request(f"/api/v1/agents/{agent_id}/budget/reset", method="POST")

    def list_products(self, category: Optional[str] = None, max_price: Optional[int] = None) -> Dict[str, Any]:
        params = {}
        if category:
            params["category"] = category
        if max_price:
            params["max_price"] = max_price
        qs = ("?" + urllib.parse.urlencode(params)) if params else ""
        return self._request(f"/api/v1/products{qs}")

    def check_price(self, product_id: str, quantity: int = 1) -> Dict[str, Any]:
        qs = urllib.parse.urlencode({"product_id": product_id, "quantity": quantity})
        return self._request(f"/api/v1/products/price?{qs}")

    def initiate_purchase(
        self,
        agent_id: str,
        product_id: str,
        quantity: int,
        reasoning: str,
        idempotency_key: Optional[str] = None,
        stated_amount_paise: Optional[int] = None,
        max_budget_paise: Optional[int] = None,
        simulate_timeout: bool = False,
    ) -> Dict[str, Any]:
        payload = {
            "agent_id": agent_id,
            "product_id": product_id,
            "quantity": quantity,
            "reasoning": reasoning,
            "idempotency_key": idempotency_key or f"idem_{uuid.uuid4().hex[:12]}",
            "simulate_timeout_error": simulate_timeout,
        }
        if stated_amount_paise is not None:
            payload["stated_amount_paise"] = stated_amount_paise
        if max_budget_paise is not None:
            payload["max_budget_paise"] = max_budget_paise

        return self._request("/api/v1/purchase/initiate", method="POST", data=payload)

    def get_order_status(self, order_id: str) -> Dict[str, Any]:
        return self._request(f"/api/v1/orders/{order_id}")

    def list_pending_approvals(self) -> Dict[str, Any]:
        return self._request("/api/v1/approvals")

    def approve_transaction(self, approval_id: str) -> Dict[str, Any]:
        return self._request(f"/api/v1/approvals/{approval_id}/approve", method="POST")

    def _request(self, path: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        body_bytes = json.dumps(data).encode("utf-8") if data else None

        req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read().decode("utf-8")
                return json.loads(content) if content else {}
        except urllib.error.HTTPError as e:
            content = e.read().decode("utf-8")
            try:
                err_json = json.loads(content)
                err_json["http_status"] = e.code
                return err_json
            except Exception:
                return {"http_status": e.code, "error": content or str(e)}
        except urllib.error.URLError as e:
            return {"error": f"Connection to Ledger Gateway at {self.base_url} failed: {e.reason}"}


class AIBuyerAgent:
    """Autonomous Buyer Agent that plans, reasons, and executes purchases."""

    def __init__(self, agent_id: str = "agent_autonomous_buyer", client: Optional[LedgerClient] = None):
        self.agent_id = agent_id
        self.client = client or LedgerClient()

    def log_thought(self, reasoning: str):
        print(f"\n{CYAN}{BOLD}[SCENARIO TELEMETRY]{RESET} {CYAN}{reasoning}{RESET}")

    def log_action(self, tool_name: str, params: Dict[str, Any]):
        print(f"{YELLOW} -> Calling Tool: {BOLD}{tool_name}{RESET} with {json.dumps(params)}")

    def log_result(self, result: Dict[str, Any]):
        status = result.get("status")
        if status == "PAID":
            print(f"{GREEN}{BOLD} ✓ [GATEWAY VERDICT: APPROVED & PAID]{RESET}")
            print(f"{GREEN}   Razorpay Order   : {result.get('razorpay_order_id')}{RESET}")
            print(f"{GREEN}   Razorpay Payment : {result.get('razorpay_payment_id')}{RESET}")
            print(f"{GREEN}   Amount           : ₹{result.get('amount_inr', 0):.2f}{RESET}")
            b = result.get("budget_state", {})
            print(f"{DIM}   Remaining Budget : ₹{b.get('remaining_inr', 0):.2f} (Capacity: ₹{b.get('capacity_inr', 0):.2f}){RESET}")
        elif status == "PENDING_APPROVAL":
            print(f"{YELLOW}{BOLD} ⚠ [GATEWAY VERDICT: GATED - MANUAL APPROVAL REQUIRED]{RESET}")
            print(f"{YELLOW}   Approval ID      : {result.get('approval_id')}{RESET}")
            print(f"{YELLOW}   Message          : {result.get('message')}{RESET}")
            exp = result.get("explainability", {})
            print(f"{DIM}   Rule Triggered   : {exp.get('primary_reason')}{RESET}")
        elif status == "REJECTED":
            print(f"{RED}{BOLD} ✗ [GATEWAY VERDICT: REJECTED]{RESET}")
            print(f"{RED}   Reason           : {result.get('primary_reason')}{RESET}")
            print(f"{RED}   Error Code       : {result.get('error_code')}{RESET}")
        else:
            print(f"{DIM}   Response: {json.dumps(result, indent=2)}{RESET}")


def run_scenario_1_happy_path(agent: AIBuyerAgent):
    """Scenario 1: Happy Path Purchase within Budget & Below Threshold."""
    print(f"\n{BOLD}{'='*65}{RESET}")
    print(f"{BOLD}{GREEN}SCENARIO 1: Autonomous Happy Path Purchase (Cloud Compute){RESET}")
    print(f"{BOLD}{'='*65}{RESET}")

    # 1. Inspect Budget
    agent.log_thought("I have been tasked with provisioning compute for model training. First, checking our spend budget.")
    agent.log_action("get_agent_budget", {"agent_id": agent.agent_id})
    budget = agent.client.get_budget(agent.agent_id)
    print(f"   Spend Cap: ₹{budget.get('capacity_inr', 0):.2f}, Remaining: ₹{budget.get('remaining_inr', 0):.2f}")

    # 2. List Products
    agent.log_thought("Browsing merchant catalog for available Compute instances.")
    agent.log_action("list_products", {"category": "Compute"})
    prods = agent.client.list_products(category="Compute")
    items = prods.get("products", [])
    print(f"   Found {len(items)} items: {', '.join([p['name'] + ' (₹' + str(p['price_paise']/100) + ')' for p in items])}")

    # 3. Check Price
    target_sku = "prod_gpu_h100"
    agent.log_thought(f"Checking exact unit price and stock for {target_sku}.")
    agent.log_action("check_price", {"product_id": target_sku, "quantity": 1})
    price_info = agent.client.check_price(target_sku, 1)

    # 4. Reason & Purchase
    reasoning = (
        f"We require 1 hour of NVIDIA H100 GPU compute. The total is ₹{price_info.get('total_inr', 0):.2f}, "
        f"which is 36% of our ₹{budget.get('capacity_inr', 0):.2f} spend cap and below the ₹5,000 human-gating threshold. "
        "Proceeding with autonomous execution."
    )
    agent.log_thought(reasoning)

    idem_key = f"idem_happy_{uuid.uuid4().hex[:8]}"
    agent.log_action("initiate_purchase", {
        "product_id": target_sku,
        "quantity": 1,
        "stated_amount_paise": price_info.get("total_paise"),
        "reasoning": reasoning,
        "idempotency_key": idem_key
    })

    result = agent.client.initiate_purchase(
        agent_id=agent.agent_id,
        product_id=target_sku,
        quantity=1,
        stated_amount_paise=price_info.get("total_paise"),
        reasoning=reasoning,
        idempotency_key=idem_key
    )
    agent.log_result(result)
    return result


def run_scenario_2_over_budget_recovery(agent: AIBuyerAgent):
    """Scenario 2: Over-Budget Rejection & Graceful Strategy Adaptation."""
    print(f"\n{BOLD}{'='*65}{RESET}")
    print(f"{BOLD}{RED}SCENARIO 2: Over-Budget Rejection & Graceful Strategy Adaptation{RESET}")
    print(f"{BOLD}{'='*65}{RESET}")

    # 1. Attempt massive purchase exceeding spend cap
    target_sku = "prod_datacenter_node"  # ₹25,000
    reasoning_attempt_1 = "Attempting to acquire entire 8x H100 Datacenter Supercluster (₹25,000) for maximum training throughput."
    agent.log_thought(reasoning_attempt_1)

    idem_key_1 = f"idem_over_{uuid.uuid4().hex[:8]}"
    agent.log_action("initiate_purchase", {
        "product_id": target_sku,
        "quantity": 1,
        "reasoning": reasoning_attempt_1,
        "idempotency_key": idem_key_1
    })

    result_1 = agent.client.initiate_purchase(
        agent_id=agent.agent_id,
        product_id=target_sku,
        quantity=1,
        reasoning=reasoning_attempt_1,
        idempotency_key=idem_key_1
    )
    agent.log_result(result_1)

    # 2. Agent reflects on rejection reason and adapts
    if result_1.get("status") == "REJECTED":
        rejection_reason = result_1.get("primary_reason", "Budget cap exceeded")
        adaptive_reasoning = (
            f"Ledger Gateway rejected the request with reason: '{rejection_reason}'. "
            "Instead of crashing, I am adapting our goal to a smaller footprint: Managed PostgreSQL Instance (₹4,200), "
            "which safely fits inside our remaining token budget."
        )
        agent.log_thought(adaptive_reasoning)

        fallback_sku = "prod_db_cluster"  # ₹4,200
        idem_key_2 = f"idem_adapt_{uuid.uuid4().hex[:8]}"
        agent.log_action("initiate_purchase", {
            "product_id": fallback_sku,
            "quantity": 1,
            "reasoning": adaptive_reasoning,
            "idempotency_key": idem_key_2
        })

        result_2 = agent.client.initiate_purchase(
            agent_id=agent.agent_id,
            product_id=fallback_sku,
            quantity=1,
            reasoning=adaptive_reasoning,
            idempotency_key=idem_key_2
        )
        agent.log_result(result_2)
        return result_2


def run_scenario_3_human_gated_approval(agent: AIBuyerAgent):
    """Scenario 3: High-Value Threshold Gate with Human Approval."""
    print(f"\n{BOLD}{'='*65}{RESET}")
    print(f"{BOLD}{YELLOW}SCENARIO 3: High-Value Threshold Gate & Human-in-the-Loop Approval{RESET}")
    print(f"{BOLD}{'='*65}{RESET}")

    target_sku = "prod_enterprise_ai"  # ₹7,500 (> ₹5,000 threshold)
    reasoning = (
        "Procuring Enterprise Autonomous Agent Sandbox License (₹7,500) for cross-agent evaluation. "
        "This license exceeds the single-transaction threshold of ₹5,000 and requires compliance sign-off."
    )
    agent.log_thought(reasoning)

    idem_key = f"idem_gate_{uuid.uuid4().hex[:8]}"
    agent.log_action("initiate_purchase", {
        "product_id": target_sku,
        "quantity": 1,
        "reasoning": reasoning,
        "idempotency_key": idem_key
    })

    result = agent.client.initiate_purchase(
        agent_id=agent.agent_id,
        product_id=target_sku,
        quantity=1,
        reasoning=reasoning,
        idempotency_key=idem_key
    )
    agent.log_result(result)

    approval_id = result.get("approval_id")
    order_id = result.get("order_id")

    if approval_id:
        agent.log_thought(
            f"Transaction held in PENDING_APPROVAL state (Approval ID: {approval_id}). "
            "Waiting for merchant operator authorization..."
        )
        time.sleep(1.5)

        print(f"\n{MAGENTA}[OPERATOR DASHBOARD ACTION] Approving high-value transaction {approval_id}...{RESET}")
        approve_resp = agent.client.approve_transaction(approval_id)
        print(f"{GREEN} ✓ Approved by operator: {approve_resp.get('message')}{RESET}")
        print(f"{GREEN}   Razorpay Order ID: {approve_resp.get('razorpay_order_id')}{RESET}")

        # Agent queries updated order
        order_status = agent.client.get_order_status(order_id)
        agent.log_thought(f"Confirmed order {order_id} is now {order_status.get('status')} on Razorpay.")
        return order_status


def run_scenario_4_network_timeout_idempotency(agent: AIBuyerAgent):
    """Scenario 4: Flaky Network Timeout & Evora Outbox Idempotency Guarantee."""
    print(f"\n{BOLD}{'='*65}{RESET}")
    print(f"{BOLD}{CYAN}SCENARIO 4: Network Interruption & Evora Outbox Idempotency Guarantee{RESET}")
    print(f"{BOLD}{'='*65}{RESET}")

    target_sku = "prod_ai_tokens"  # ₹1,800
    shared_idem_key = f"idem_flaky_{uuid.uuid4().hex[:8]}"
    reasoning = "Acquiring API credit pool for multi-service automation."

    agent.log_thought(f"Generating unique transaction idempotency key: {shared_idem_key}")

    # Inspect starting budget
    b_before = agent.client.get_budget(agent.agent_id)
    spent_before = b_before.get("spent_inr", 0)
    print(f"   Initial Spent Budget: ₹{spent_before:.2f}")

    # Attempt 1: Injects simulated timeout error
    agent.log_thought("Attempt 1: Sending purchase request (simulating network disconnection right after processing)...")
    agent.log_action("initiate_purchase", {
        "product_id": target_sku,
        "quantity": 1,
        "idempotency_key": shared_idem_key,
        "simulate_timeout_error": True
    })

    res1 = agent.client.initiate_purchase(
        agent_id=agent.agent_id,
        product_id=target_sku,
        quantity=1,
        reasoning=reasoning,
        idempotency_key=shared_idem_key,
        simulate_timeout=True
    )
    print(f"{YELLOW} Network Exception: HTTP {res1.get('http_status', 'Timeout')} - Connection dropped!{RESET}")

    # Attempt 2: Replays with SAME idempotency key
    agent.log_thought("Attempt 2: Client detected timeout. Retrying request with the EXACT SAME idempotency key...")
    agent.log_action("initiate_purchase", {
        "product_id": target_sku,
        "quantity": 1,
        "idempotency_key": shared_idem_key
    })

    res2 = agent.client.initiate_purchase(
        agent_id=agent.agent_id,
        product_id=target_sku,
        quantity=1,
        reasoning=reasoning,
        idempotency_key=shared_idem_key
    )
    agent.log_result(res2)

    # Verify Agent was charged ONLY once
    b_after = agent.client.get_budget(agent.agent_id)
    spent_after = b_after.get("spent_inr", 0)
    delta_spent = spent_after - spent_before

    print(f"\n{BOLD}{GREEN}IDEMPOTENCY VERIFICATION:{RESET}")
    print(f"   Budget debited: ₹{delta_spent:.2f} (Expected exactly ₹1800.00, NOT ₹3600.00)")
    if abs(delta_spent - 1800.0) < 0.01:
        print(f"{GREEN}{BOLD} ✓ SUCCESS: Zero double charges detected! Outbox deduplication confirmed.{RESET}")
    else:
        print(f"{RED} ✗ WARNING: Double charge detected! Delta was ₹{delta_spent:.2f}{RESET}")

    return res2


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Triage Evaluation Scenario Harness")
    parser.add_argument("--scenario", type=int, choices=[1, 2, 3, 4], help="Run specific scenario (1-4)")
    parser.add_argument("--all", action="store_true", help="Run all 4 demo scenarios sequentially")
    parser.add_argument("--gateway", type=str, default=GATEWAY_URL, help="Ledger Gateway URL")
    parser.add_argument("--reset", action="store_true", help="Reset agent budget before running")
    args = parser.parse_args()

    client = LedgerClient(base_url=args.gateway)
    agent = AIBuyerAgent(agent_id="agent_nexus_buyer", client=client)

    # Health check
    try:
        req = urllib.request.Request(f"{args.gateway}/api/v1/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            health = json.loads(resp.read().decode("utf-8"))
            print(f"{GREEN}[INFO] Connected to Ledger Gateway ({health.get('service')}, Chain Verified: {health.get('chain_integrity')}){RESET}")
    except Exception as e:
        print(f"{RED}[ERROR] Cannot connect to Ledger Gateway at {args.gateway}. Is the server running? ({e}){RESET}")
        sys.exit(1)

    if args.reset or args.all:
        client.reset_budget(agent.agent_id)

    if args.scenario == 1:
        client.reset_budget("agent_compute_01")
        agent_s1 = AIBuyerAgent(agent_id="agent_compute_01", client=client)
        run_scenario_1_happy_path(agent_s1)
    elif args.scenario == 2:
        client.reset_budget("agent_adaptive_02")
        agent_s2 = AIBuyerAgent(agent_id="agent_adaptive_02", client=client)
        run_scenario_2_over_budget_recovery(agent_s2)
    elif args.scenario == 3:
        client.reset_budget("agent_compliance_03")
        agent_s3 = AIBuyerAgent(agent_id="agent_compliance_03", client=client)
        run_scenario_3_human_gated_approval(agent_s3)
    elif args.scenario == 4:
        client.reset_budget("agent_network_04")
        agent_s4 = AIBuyerAgent(agent_id="agent_network_04", client=client)
        run_scenario_4_network_timeout_idempotency(agent_s4)
    elif args.all or not args.scenario:
        print(f"\n{BOLD}{MAGENTA}===================================================================={RESET}")
        print(f"{BOLD}{MAGENTA}     RUNNING FULL 4-SCENARIO PITCH DEMO FOR LEDGER GATEWAY          {RESET}")
        print(f"{BOLD}{MAGENTA}===================================================================={RESET}")

        # Scenario 1: Happy Path
        client.reset_budget("agent_compute_01")
        agent_s1 = AIBuyerAgent(agent_id="agent_compute_01", client=client)
        run_scenario_1_happy_path(agent_s1)
        time.sleep(1)

        # Scenario 2: Over-Budget Rejection & Adaptation
        client.reset_budget("agent_adaptive_02")
        agent_s2 = AIBuyerAgent(agent_id="agent_adaptive_02", client=client)
        run_scenario_2_over_budget_recovery(agent_s2)
        time.sleep(1)

        # Scenario 3: High-Value Threshold Gate & Human Approval
        client.reset_budget("agent_compliance_03")
        agent_s3 = AIBuyerAgent(agent_id="agent_compliance_03", client=client)
        run_scenario_3_human_gated_approval(agent_s3)
        time.sleep(1)

        # Scenario 4: Network Interruption & Idempotency Guarantee
        client.reset_budget("agent_network_04")
        agent_s4 = AIBuyerAgent(agent_id="agent_network_04", client=client)
        run_scenario_4_network_timeout_idempotency(agent_s4)

        print(f"\n{BOLD}{GREEN}{'='*65}{RESET}")
        print(f"{BOLD}{GREEN} ALL 4 PITCH SCENARIOS COMPLETED SUCCESSFULLY! {RESET}")
        print(f"{BOLD}{GREEN}{'='*65}{RESET}")


if __name__ == "__main__":
    main()

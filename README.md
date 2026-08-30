# Triage — Cross-Workflow Revenue Recovery Control Plane

> **"Context determines what is possible. ML determines what is preferable. Deterministic policy determines what is permissible. The executor determines what actually happens. Every outcome feeds the recovery ledger and future decisioning."**

> **Triage is a cross-workflow revenue recovery control plane that continuously detects revenue at risk, understands the context behind each opportunity, prioritizes recovery by expected value, plans bounded intervention sequences, coordinates competing recovery workflows, executes only policy-authorized actions, and measures actual money recovered.**

Satisfies **Razorpay AI Buildathon Track 03**: *Detect revenue at risk → determine the right intervention → execute a bounded recovery workflow.*

---

## 1. System Architecture & Core Authority Pipeline

```text
               REVENUE AT RISK SURFACES
 (Failed Payment · Abandoned Checkout · Failed Subscription · Overdue Invoice · Mandate Failure)
                                   │
                                   ▼
                            ┌──────────────┐
                            │ 1. DIAGNOSIS │
                            │What happened?│ → Deterministic failure mapping (8 Root Causes, 0 AI)
                            └──────┬───────┘
                                   │
                                   ▼
                           ┌───────────────┐
                           │ 2. ELIGIBILITY│
                           │What is possible│ → Context-aware instrument & action candidate bounds
                           └───────┬───────┘
                                   │
                                   ▼
                           ┌───────────────┐
                           │ 3. ML RANKING │
                           │What is better?│ → Random Forest estimates P(recover|x,a); Expected Recovery Value
                           └───────┬───────┘
                                   │
                                   ▼
                            ┌──────────────┐
                            │  4. POLICY   │
                            │What is allowed│ → Deterministic vetoes: max attempts, ₹10k threshold, fraud, concession cap
                            └──────┬───────┘
                                   │
                                   ▼
                     5. APPROVED ACTION ENVELOPE
                     (Immutable Context & Boundary)
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
                ▼                                     ▼
      COMMUNICATION BRANCH                    EXECUTION BRANCH
      (Non-Authoritative)                     (Authoritative / Idempotent)
                │                                     │
         ┌──────▼──────┐                       ┌──────▼──────┐
         │ 6. Template │                       │Deterministic│
         │    Nudge    │                       │  Executor   │
         └──────┬──────┘                       └──────┬──────┘
                │                                     │
         Output Validator                      Idempotency Check
                │                                     │
                ▼                                     ▼
         Customer Copy                         Authorized Recovery Action
                │                                     │
                ▼                                     ▼
         Customer Channel                      Razorpay API / Gateway
                │                                     │
                └──────────────────┬──────────────────┘
                                   │
                                   ▼
                          7. OUTCOME + AUDIT
                         ┌───────────────────┐
                         │ Outcome Observer  │
                         │ SHA-256 Ledger    │
                         └───────────────────┘
```

---

## 2. Positioning: How Triage Complements Existing Payment Infrastructure

| Layer | Existing Payment Infrastructure | Triage Revenue Recovery Control Plane |
|---|---|---|
| **Multi-Surface Detection** | Disconnected payment, cart, subscription, invoice tables | Unified detection across checkouts, subscriptions, invoices, mandates |
| **Failure Diagnosis** | Raw gateway error codes (`BAD_REQUEST`, `504`) | 8-cause deterministic diagnosis taxonomy with structured telemetry parsing |
| **Eligibility & Candidates** | Blind retries on the same failed instrument | Context-aware candidate generation based on alternate cards, UPI, payday proximity |
| **Recovery Decision** | Static rules / arbitrary schedules | ML ranking by Expected Recovery Value ($\text{ERV} = \hat{P}(\text{recover}) \times \text{Amount}$) |
| **Workflow Planning** | Single-shot retries | Bounded multi-step state machines with strict stopping conditions |
| **Customer Coordination** | Workflows harass customers independently | Cross-workflow coordinator with 4h cooldowns and priority suppression |
| **Governance & Policy** | Platform / merchant basic limits | Deterministic policy vetoes: max attempts (3/3), ₹10k ceiling, concession cap (≤5% & ≤₹500), fraud stop |
| **Execution Authority** | Standard API calls | Cryptographically idempotent execution (`same action + key → one financial effect`) |
| **Auditability** | Standard logs | Immutable SHA-256 hash-chained recovery ledger with real-time SSE stream |

---

## 3. Authoritative Canonical Recovery Action Taxonomy

| Action Identifier | Category | Allowed Failure Causes | Description |
|---|---|---|---|
| `RETRY_SAME_RAIL_COOLDOWN` | Retry | `BANK_DOWNTIME_TIMEOUT`, `NETWORK_DECLINE` | Automated retry after cooldown during off-peak hours |
| `RETRY_NEXT_PAYDAY_WINDOW` | Retry | `INSUFFICIENT_FUNDS` | Automated retry scheduled near customer salary cycle |
| `SWITCH_TO_SAVED_CARD` | Switch Rail | `INSUFFICIENT_FUNDS` | Instant 1-tap switch to verified active backup card |
| `SWITCH_TO_AVAILABLE_ALTERNATE_RAIL` | Switch Rail | `BANK_DOWNTIME_TIMEOUT`, `EXPIRED_CARD`, `OTP_DROP_OFF`, `MANDATE_REVOKED`, `NETWORK_DECLINE` | Route to active alternative payment method (e.g. UPI) |
| `UPDATE_PAYMENT_METHOD` | Customer Action | `EXPIRED_CARD` | Secure link for customer to replace invalid instrument |
| `RESUME_CHECKOUT` | Customer Action | `OTP_DROP_OFF` | 1-click cart resumption link after auth drop-off |
| `REAUTHORIZE_MANDATE` | Customer Action | `MANDATE_REVOKED` | 1-click recurring mandate renewal link |
| `COLLECT_OUTSTANDING_PAYMENT` | Invoice | `MANDATE_REVOKED`, `INSUFFICIENT_FUNDS` | Settle overdue commercial invoice |
| `PROMISE_TO_PAY` | Customer Action | `INSUFFICIENT_FUNDS` | Conversational date agreement scheduled deterministically |
| `INCENTIVE_DISCOUNT` | Concession | `INSUFFICIENT_FUNDS`, `MANDATE_REVOKED` | Concession discount capped at $\le 5\%$ of amount AND $\le \text{₹}500$ |
| `ESCALATE_HUMAN` | Safety / Fallback | All Causes | Routed to senior retention/risk desk for manual triage |
| `STOP` | Safety / Fallback | `FRAUD_SUSPECTED`, `UNKNOWN` | Immediate cessation of automated recovery (zero retry) |
| `MARK_LOST_EXHAUSTED` | Terminal State | All Causes | Final state after 3 failed attempts (stopping rule) |

---

## 4. Multi-Surface Revenue Opportunity Model

Triage continuously ingests and prioritizes revenue at risk across 6 distinct surfaces:

1. **`FAILED_PAYMENT`**: Single-purchase gateway card/netbanking declines.
2. **`ABANDONED_CHECKOUT`**: Cart abandonment during 3DS/OTP verification windows.
3. **`FAILED_SUBSCRIPTION`**: Recurring subscription billing soft/hard declines.
4. **`OVERDUE_INVOICE`**: Commercial B2B invoices past due date.
5. **`MANDATE_FAILURE`**: Autopay / NACH recurring mandate revocations.
6. **`PROMISE_TO_PAY`**: Customer-committed deferred payment schedules.

---

## 5. Portfolio Prioritization & Transparent Scoring

Instead of blind FIFO processing, Triage computes transparent expected recovery priority scores:

$$\text{PriorityScore} = \text{NetExpectedRecovery} \times \text{TimeSensitivity} \times \text{CustomerValueFactor} - \text{RiskPenalty}$$

Where:
- $\text{NetExpectedRecovery} = \hat{P}(\text{recover} \mid \mathbf{x}, a) \times (\text{Amount} - \text{Concession}) - \text{InterventionCost}$
- $\text{TimeSensitivity} \in [0.1, 2.0]$: Bounded function of opportunity age (highest immediately for abandoned checkouts, increasing with invoice age, peaking near payday for subscriptions).
- $\text{CustomerValueFactor} \in [0.5, 1.5]$: Gated on whether historical payment attempts were observed ($\text{HistoricalAttempts} > 0$), computing $0.5 + \text{HistoricalSuccessRate}$. True cold-starts ($\text{HistoricalAttempts} = 0$) default to `1.0` (neutral multiplier), while observed chronic failure ($0/10$ attempts) computes to `0.5` (maximum penalty).
- $\text{InterventionCost}$: Action-specific operational cost (₹50 human desk, ₹20 PTP, ₹5 automated).
- $\text{RiskPenalty}$: Penalty for high retry attempts (₹10 per attempt); full amount deduction for fraud suspicion.

---

## 6. Cross-Workflow Customer Coordination

To prevent independent automated workflows from harassing the same customer:
- **Mandatory Contact Cooldown**: At least 4 hours between any customer-facing communication across all workflows.
- **Priority-Based Suppression**: When a customer has multiple open opportunities, higher-value items (e.g. ₹18,000 cart) are prioritized; lower-value messages (e.g. ₹4,200 subscription) are suppressed.
- **Global Fraud Freeze**: A security flag on any transaction freezes automated recovery across all customer accounts.

---

## 7. Deterministic Policy Enforcement (The 5 Rules)

1. **`CANDIDATE_LEGITIMACY`**: The proposed action must exist in the context-eligible candidate set.
2. **`MAX_ATTEMPTS_LIMIT`**: Total attempts must be $< 3$. When attempts reach 3, the stopping rule enforces `MARK_LOST_EXHAUSTED`.
3. **`FRAUD_SECURITY_GATE`**: If root cause is `FRAUD_SUSPECTED`, automated recovery is vetoed and immediately stopped.
4. **`HIGH_VALUE_THRESHOLD`**: If amount $\ge \text{₹}10,000$, automated recovery is vetoed and routed to Senior Retention Desk.
5. **`CONCESSION_BUDGET_CAP`**: Any incentive discount must be $\le 5\%$ of transaction amount AND $\le \text{₹}500$.

---

## 8. Bounded Recovery Plan & Deterministic Scheduler

- Every case receives a **bounded recovery plan** with at most 5 steps.
- Termination guarantee: every plan ends in `SUCCESS`, `STOP`, `ESCALATE_HUMAN`, or `MARK_LOST_EXHAUSTED`.
- The **deterministic scheduler** supports simulated clock advancement (`/api/v1/triage/scheduler/advance`) to allow reproducible end-to-end time testing without real-world delays.

---

## 9. Test Suite: 10 End-to-End Scenarios

Run the complete 10-scenario validation suite:

```bash
cd agent
python triage_scenarios.py --all
```

| Scenario | Name | Key Verification |
|---|---|---|
| **1** | `INSUFFICIENT_FUNDS` + Payday Near | ML selects `RETRY_NEXT_PAYDAY_WINDOW` based on 1-day proximity |
| **2** | `INSUFFICIENT_FUNDS` + Backup Card | ML shifts to `SWITCH_TO_SAVED_CARD` (eliminates 18-day payday wait) |
| **3** | `EXPIRED_CARD` Instrument Invalidation | Candidate bounds enforce `UPDATE_PAYMENT_METHOD` (zero blind retry) |
| **4** | High-Value Threshold Veto | ₹12,500 transaction vetoed by policy $\ge \text{₹}10,000$ ceiling $\rightarrow$ human desk |
| **5** | Deterministic PTP Parsing | Regex extracts dates/affirmations; ambiguous natural language escalates to human |
| **6** | `FRAUD_SUSPECTED` Security Stop | Security flag triggers immediate `STOP` (zero retry, zero automated payment) |
| **7** | Cross-Workflow Customer Coordination | Single customer with 3 items: higher-value checkout prioritized, subscription suppressed |
| **8** | Bounded Recovery Plan + Scheduler | Multi-step plan created $\rightarrow$ clock advanced by 4h $\rightarrow$ scheduled step executed |
| **9** | Attempt Exhaustion Ceiling | 3/3 attempts triggers stopping rule $\rightarrow$ `MARK_LOST_EXHAUSTED` (ceases contact) |
| **10** | Cryptographic Idempotency | Replayed requests return cached response; hash chain integrity verified |

---

## 10. Held-Out ML Model Benchmark & Provenance
 
### Benchmark v1: Canonical Held-Out Test Partition (750 Cases, Stochastic Evaluation)
- **Evaluation Methodology**: 750 realistic held-out test cases evaluated under irreducible Bernoulli payment outcome entropy ($y \sim \text{Bernoulli}(P(\text{recover} \mid \mathbf{x}, a))$) using common random numbers against identical policy constraints and failure codes.
- **Model Architecture**: Random Forest Classifier (100 estimators, bagging ensemble).
- **Model Accuracy**: ROC-AUC `0.7819` | Precision `0.6788` | Recall `0.8478` | F1-Score `0.7539` | Accuracy `0.7192`
- **Total Revenue At Risk**: **₹4,346,400.00**
- **Static Baseline Recovery**: ₹2,665,700.00 (62.80%)
- **ML Policy Recovery**: **₹2,962,000.00** (68.40%)
- **Absolute Recovery Rate Uplift**: **+5.60 percentage points** ($68.40\% - 62.80\%$)
- **Relative Revenue Uplift**: **+11.12%** ($+₹296,300.00$ net gain)
- **Benchmark Leader (XGBoost)**: Achieves ROC-AUC `0.7953`, 71.73% recovery (+8.93pp uplift, +17.49% relative, +₹466,300.00); Random Forest is deployed to production for zero external C++ native runtime drift and auditable decision trees.

### Benchmark v2: Interactive Scenario Test Batch (50 Cases)
- **Evaluation Partition**: Live dynamic test batch run during demo execution (`python triage_scenarios.py --all` or UI Batch Harness).
- **Total Revenue At Risk**: ₹225,100.00 (50 cases)
- **Static Baseline Recovery**: ₹147,100.00 (65.3%)
- **ML Policy Recovery**: **₹181,100.00** (80.5%)
- **Relative Revenue Uplift**: **+23.11%** (+15.10 percentage points absolute recovery rate)


---

## 11. Quickstart & Verification

### Start the Gateway:
```bash
cd gateway
go run ./cmd/gateway/main.go
```

### Run Go Unit Tests:
```bash
cd gateway
go test -v ./...
```

### Run All 10 Scenarios:
```bash
cd agent
python triage_scenarios.py --all
```

### Start the Dashboard:
```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

### Start the Storefront:
```bash
cd storefront
npm run dev
# Open http://localhost:5173
```

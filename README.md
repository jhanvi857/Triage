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

| Layer | Existing Payment Infrastructure (Siloed per Product) | Triage Revenue Recovery Control Plane (Cross-Workflow) |
|---|---|---|
| **Multi-Surface Detection** | **Product-siloed tables**: Separate failure event streams and retry queues for Checkouts, Subscriptions, Payment Links, and Invoices | **Unified control plane**: Continuously correlates and prioritizes revenue at risk across all 6 commercial surfaces in a single pane |
| **Failure Diagnosis** | **Localized error mapping**: Product-specific gateway decline reason parsing (`BAD_REQUEST`, `GATEWAY_TIMEOUT`) | **Deterministic 8-cause taxonomy**: Universal failure classification across all payment rails with structured telemetry enrichment |
| **Eligibility & Candidates** | **Product-scoped actions**: Optimizer dynamically switches gateway rails for checkouts; Subscriptions triggers dunning schedules | **Global candidate generation**: Evaluates all potential recovery pathways (backup card, instant UPI intent, payday window, conversational PTP, net-30 invoice) regardless of originating product |
| **Recovery Decisioning** | **Independent routing models**: Sub-product ML optimizes specific rail authorization probability | **Cross-workflow Expected Value**: Ranks actions by net Expected Recovery Value ($\text{ERV} = \hat{P}(\text{recover} \mid \mathbf{x}, a) \times (\text{Amount} - \text{Concession}) - \text{Cost}$) across all available recovery mechanisms |
| **Workflow State Machine** | **Product-isolated lifecycles**: Fixed retry intervals managed within individual product silos | **Bounded multi-step state machine**: End-to-end plan execution with deterministic stopping conditions ($\le 3$ attempts, exhaustion, fraud stop) |
| **Customer Coordination** | **Uncoordinated multi-channel outreach**: Independent alerts from subscription dunning, cart abandonment, and invoices can contact the same customer simultaneously | **Central cross-workflow coordinator**: Enforces global contact cooldowns (minimum 4 hours), suppresses lower-value messages, and prevents customer fatigue across all accounts |
| **Governance & Policy** | **Merchant configuration limits**: Configured per payment method or subscription plan | **Centralized deterministic policy envelope**: Platform-wide hard limits: max 3 attempts, ₹10k high-value human escalation gate, concession caps ($\le 5\%$ & $\le \text{₹}500$), and immediate fraud freezes |
| **Execution Authority** | **Direct product API execution**: Standard gateway capture, refund, and mandate calls with merchant API keys | **Policy-bounded execution envelope**: Executes only actions satisfying deterministic policy, verified through an immutable SHA-256 hash-chained recovery ledger |
| **Audit & Ledger Visibility** | **Siloed transaction logs & webhook histories**: Dispersed across product dashboards | **Cryptographic SHA-256 Recovery Ledger**: Real-time SSE telemetry feed and hash-chained audit trail unifying all recovery decisions, policy vetoes, and financial outcomes |

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
- **Total Revenue At Risk**: **₹4,346,400.00** (750 cases)
- **Static Baseline Recovery**: ₹2,665,700.00 (**61.33%** Revenue Recovery | 62.80% Case Volume)
- **ML Policy Recovery (Random Forest)**: **₹2,962,000.00** (**68.15%** Revenue Recovery | 68.40% Case Volume)
- **Absolute Revenue Recovery Uplift**: **+6.82 percentage points** ($68.15\% - 61.33\%$)
- **Relative Revenue Uplift**: **+11.12%** ($+₹296,300.00 / ₹2,665,700.00$ net gain)
- **Absolute Case Volume Uplift**: **+5.60 percentage points** ($68.40\% - 62.80\%$)
- **Benchmark Leader (XGBoost)**: Achieves ROC-AUC `0.7953`, ₹3,132,000.00 recovered (**72.06%** Revenue Recovery | 71.73% Case Volume, +10.73pp revenue uplift, +17.49% relative gain, +₹466,300.00); Random Forest is deliberately deployed to production for zero external C++ native runtime drift, deterministic execution, and auditable decision trees.

### Benchmark v2: Interactive Scenario Test Batch (50 Cases)
- **Evaluation Partition**: Live dynamic test batch run during demo execution (`python triage_scenarios.py --all` or UI Batch Harness).
- **Total Revenue At Risk**: ₹225,100.00 (50 cases)
- **Static Baseline Recovery**: ₹147,100.00 (65.35%)
- **ML Policy Recovery**: **₹181,100.00** (80.45%)
- **Relative Revenue Uplift**: **+23.11%** (+15.10 percentage points absolute recovery rate)


---

## 11. Customer Billing Portal & 1-Click Email Settlement

Triage provides a self-serve recovery portal and email authorization flow that balances proactive customer engagement with strict financial accounting:

### A. Customer Billing Portal (`/portal`)
- **Central Self-Serve Hub**: Real-time overview of all customer invoices, active subscriptions, and payment statuses.
- **In-Progress Status Transparency**: Clear visual distinction between unaddressed declines and active recovery workflows:
  - `Action Required`: Fresh decline requiring customer attention.
  - `Retry scheduled — {date}`: Automated off-peak or payday auto-retry locked in ledger.
  - `Promise to pay — due {date}`: Deferred settlement agreement registered via NLP.
  - `With support specialist`: Policy-vetoed or high-value case routed to retention desk.
- **Softened In-Progress Framing**: Header counters dynamically categorize items as `{pendingActionCount} Action Required • {inProgressCount} In Progress`, preventing repetitive customer friction.

### B. Outbound SMTP Relay & Email-Gated 1-Click Authorization
- **Live SMTP Dispatch**: Integrates with standard authenticated SMTP relays (e.g. Gmail App Passwords, SendGrid, Amazon SES) for real inbox delivery.
- **1-Click Settlement URLs**: Dispatches signed recovery links (`/status/{CASE_ID}?action=complete_recovery`). Clicking the link directly from the email completes settlement and captures payment on Razorpay sandbox.
- **On-Screen Confirmation Gating**: Web buttons on the recovery center dispatch the authorization link and prompt the user to confirm via their email, ensuring explicit customer intent before state transitions.

### C. Strict Recovery-Accounting Invariant
- **Authoritative Capture Invariant**: A case **only** transitions to `RECOVERED` upon verified payment capture via `RecordCapture()`.
- **Zero Premature Revenue**: Scheduling an auto-retry, committing a promise-to-pay (PTP), or updating an instrument leaves `amount_recovered = 0` until funds clear.
- **Immutable Terminal State**: Downgrading an already-recovered case away from `RECOVERED` is strictly forbidden and protected by ledger state assertions.

---

## 12. Quickstart & Configuration

### 1. Configure Outbound SMTP (Optional for Live Emails):
Copy `.env.example` to `gateway/.env` and provide your credentials (e.g. Gmail App Password):
```bash
cp .env.example gateway/.env
# Edit gateway/.env:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-16-char-app-password
```

### 2. Start the Gateway:
```bash
cd gateway
go run ./cmd/gateway/main.go
# API Server listening on http://localhost:8080
```

### 3. Run Go Unit Tests:
```bash
cd gateway
go test -v ./...
```

### 4. Run All 10 End-to-End Scenarios:
```bash
cd agent
python triage_scenarios.py --all
```

### 5. Start the Operations Dashboard:
```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

### 6. Start the Customer Storefront & Billing Portal:
```bash
cd storefront
npm run dev
# Merchant Storefront: http://localhost:5173
# Customer Billing Portal: http://localhost:5173/portal
```

# Triage - Autonomous AI Revenue Recovery System

> **Triage is an autonomous AI revenue recovery engine for failed subscription and invoice payments. It combines deterministic diagnosis, machine-learned intervention ranking, and strict policy gating to recover at-risk revenue safely, idempotently, and auditably.**

> **No LLM is used anywhere in Triage. Interventions are selected via a Random Forest ranking model over bounded action spaces, constrained by deterministic policy rules and logged to a SHA-256 hash-chained recovery ledger.**

---

## 1. The Core Architectural Principle

- ML ranks bounded recovery choices.
Deterministic code diagnoses, authorizes, limits, executes, and audits.

- **Zero LLMs / Zero Generative Copy**: All customer communications use deterministic template substitution (`templates[Cause][Action]`).
- **Zero AI in Financial Execution**: Every money movement is strictly authorized by deterministic policy rules before execution on Razorpay APIs.
- **Zero Hallucinated Actions**: The ML model cannot invent actions; it scores only pre-approved, cause-bounded candidates.
- **Deterministic Promise-to-Pay (PTP)**: Uses regex date matching for predefined patterns; ambiguous language routes safely to human retention desks.
- **Evora Idempotency Protocol**: Guarantees zero double charges or repeated dunning on webhook re-delivery.
- **Cryptographically Auditable**: All state transitions append to a SHA-256 hash-chained ledger.

---

## 2. The 5-Step Operational Pipeline

```text
[ Razorpay Failure Telemetry / Webhook ]
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Step 1: Deterministic Diagnosis        │ ──► Structured error mapping (7 Root Causes, 0 AI)
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Step 2: Bounded Candidate Generation   │ ──► Strict allowed candidate action set
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Step 3: ML Ranking & Expected Value    │ ──► P(recover | x, a) × Amount (Random Forest)
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Step 4: Deterministic Policy Veto      │ ──► Max 3 Retries, ₹500 Cap, ₹10k Escalation, Fraud Gate
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Step 5: Idempotent Razorpay Execution  │ ──► SHA-256 Keyed Outbox, 0 Double Charges
└─────────────────┬────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│   Cryptographic SHA-256 Recovery Ledger  │ ──► Tamper-Evident Hash Chain Audit Trail
└──────────────────────────────────────────┘
```

---

## 3. Failure Diagnosis Taxonomy (`gateway/internal/diagnosis`)

100% deterministic classification of Razorpay failure telemetry into 7 operational causes:

| Root Cause Code | Technical Pattern | Deterministic Action Set | Policy Guardrails |
|---|---|---|---|
| `BANK_DOWNTIME_TIMEOUT` | HTTP 504 / Gateway Timeout | `RETRY_SAME_RAIL_COOLDOWN`, `SWITCH_RAIL_UPI`, `ESCALATE_HUMAN` | 4h cooldown on same rail |
| `INSUFFICIENT_FUNDS` | Soft Balance Decline | `RETRY_LATER`, `RETRY_NEXT_PAYDAY_WINDOW`, `INCENTIVE_DISCOUNT`, `ESCALATE_HUMAN` | Max 3 attempts, ₹500 discount cap |
| `EXPIRED_CARD` | Expired Instrument | `CUSTOMER_PAYMENT_LINK`, `SWITCH_RAIL_UPI`, `ESCALATE_HUMAN` | Same-rail retry forbidden |
| `OTP_DROP_OFF` | Abandoned 3DS Challenge | `CUSTOMER_PAYMENT_LINK`, `RETRY_AUTHENTICATION`, `ESCALATE_HUMAN` | Day/night routing cadence |
| `MANDATE_REVOKED` | Autopay Cancelled at Bank | `SWITCH_RAIL_UPI`, `INCENTIVE_DISCOUNT`, `ESCALATE_HUMAN` | $\ge$ ₹10k escalates to human |
| `FRAUD_SUSPECTED` | Risk Engine Trigger | `STOP`, `ESCALATE_HUMAN` | Immediate execution halt |
| `NETWORK_DECLINE` | TCP Reset / Network Drop | `RETRY_SAME_RAIL_COOLDOWN`, `SWITCH_RAIL_UPI`, `ESCALATE_HUMAN` | Exponential backoff |
| `UNKNOWN_ERROR` | Unmapped Bank Error Code | `ESCALATE_HUMAN`, `STOP` | Mandatory human desk escalation |

---

## 4. Machine-Learned Ranking Model (`ml-service/`)

- **Model Architecture**: Tabular `RandomForestClassifier(n_estimators=100, max_depth=8)` trained with non-linear interaction effects ($\text{cause} \times \text{action} \times \text{context}$).
- **Context Features**:
  - `cause`, `amount_paise`, `attempt_number`, `time_since_failure_hours`, `original_rail`, `hour_of_day`, `payday_proximity_days`, `historical_success_rate`.
- **Ranking Objective**:
  $$\text{Expected Value}(a) = P(\text{recover} \mid \mathbf{x}, a) \times (\text{Amount} - \text{Concession}(a))$$
  $$\text{Selected Action} = \arg\max_{a \in \mathcal{A}(\text{cause})} \text{Expected Value}(a)$$

### Held-Out Test Set Benchmark (750 Test Cases Never Seen in Training):
- **ROC-AUC Score**: `0.9884`
- **Precision**: `93.96%`
- **Recall**: `93.21%`
- **F1-Score**: `0.9358`
- **Accuracy**: `93.99%`
- **Absolute Recovery Uplift**: `+5.47 percentage points` (54.40% Baseline $\rightarrow$ 59.87% ML Policy)
- **Relative Revenue Uplift**: `+24.72%` (₹24.72L $\rightarrow$ ₹30.83L on ₹47.39L at-risk)

> **Evaluation Rigor & Methodology Disclosure**:
> These held-out metrics reflect the Random Forest ranking model accurately recovering the multi-variable contextual interaction effects ($\text{cause} \times \text{action} \times \text{context}$) hand-crafted into the synthetic simulation. This demonstrates that the expected-value ranking mechanism and candidate selection engine work mathematically end-to-end, rather than claiming production human behavioral prediction. In a production deployment, the model continuously fits to merchant-specific historical decline outcomes.

---

## 5. Deterministic Policy Engine & Stopping Rules (`gateway/internal/intervention`)

The Deterministic Policy Engine holds **absolute final authority** over the ML model. The model can recommend an action, but the policy engine authorizes or vetoes it:

1. **Candidate Legitimacy**: Action must belong to the cause's explicit whitelist.
2. **Max Attempts Ceiling**: Hard cutoff at 3 attempts. At attempt $\ge 3$, all retries are vetoed $\rightarrow$ `MARK_LOST_EXHAUSTED`.
3. **High-Value Threshold**: Any transaction $\ge \text{₹}10,000$ (1,000,000 paise) is vetoed from automated dunning $\rightarrow$ escalated to Senior Human Retention Specialist.
4. **Concession Budget Cap**: Financial discounts capped at 5% and maximum ₹500 (50,000 paise).
5. **Fraud Restriction Gate**: Any security anomaly triggers an immediate automated stop.

---

## 6. Deterministic Promise-to-Pay (PTP) Parser (`gateway/internal/ptp`)

Triage does not perform general natural-language understanding or unconstrained LLM parsing. Supported patterns:
- Explicit dates: `05/09/2026`, `2026-09-05`, `5 September`
- Ordinal days: `5th`, `20th ko debit karna`
- Relative days: `tomorrow`, `kal`, `parso`
- Weekdays: `next Monday`, `on Friday`
- Affirmations: `yes`, `haan`, `ok`
- **Ambiguous Natural Language**: `"Actually things are complicated, I will pay sometime later..."` $\rightarrow$ `NEEDS_HUMAN_REVIEW` (Zero guessing).

---

## 7. Running the System Locally

### Prerequisites
- Go 1.22+
- Python 3.10+ (`scikit-learn`, `joblib`, `numpy`, `flask`, `requests`)
- Node.js 18+ (Next.js 14)

### 1. Start the ML Service
```bash
python ml-service/serve.py
# Running on http://localhost:8000
```

### 2. Start the Gateway Server
```bash
cd gateway
go run ./cmd/gateway/main.go
# Running on http://localhost:8080
```

### 3. Start the Next.js Operations Dashboard
```bash
cd dashboard
npm run dev
# Open http://localhost:3000
```

### 4. Start the Customer Storefront
```bash
cd storefront
npm run dev
# Open http://localhost:5173
```

### 5. Run the 5 Demo Scenarios & Batch Benchmark
```bash
python agent/run_scenarios.py --all
```

---

## 8. Verification Commands

```bash
# Run all Go Backend Unit Tests
cd gateway && go test -v ./...

# Run ML Service Training & Benchmark
python ml-service/train.py

# Build Next.js Production Bundle
cd dashboard && npm run build
```

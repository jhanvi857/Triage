# Triage 5-Minute Pitch Demo Script

## 0. Introduction & Architectural Hook (30 Seconds)

> *"Good afternoon. We are presenting **Triage** - an autonomous AI revenue recovery engine for failed subscription and invoice payments.*
>
> *Our core architectural principle is:*
> **ML ranks bounded recovery choices. Deterministic code diagnoses, authorizes, limits, executes, and audits.**
>
> *There is **zero generative AI**, **zero LLMs**, **zero AI in diagnosis**, and **zero AI in financial execution**. Instead, we use one tabular Random Forest ranking model over mathematically bounded action spaces, guarded by a strict deterministic policy engine, and sealed into a SHA-256 cryptographic recovery ledger."*

---

## 1. Scenario 1: Contextual ML Intervention Selection (60 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --scenario 1
```

**What is demonstrated**:
- **Case**: `INSUFFICIENT_FUNDS`, transaction amount ₹4,200.
- **Context**: Customer payday is **tomorrow** (Proximity: 1 day).
- **ML Ranking**: The Random Forest model evaluates all 4 bounded candidate actions:
  - `RETRY_LATER` / `RETRY_NEXT_PAYDAY_WINDOW`: **65.6% P(Recovery)** $\rightarrow$ **Expected Value: ₹2,755.50** (TOP RANKED)
  - `INCENTIVE_DISCOUNT`: 37.5% $\rightarrow$ Expected Value: ₹1,576.77
  - `ESCALATE_HUMAN`: 23.8% $\rightarrow$ Expected Value: ₹1,000.22
- **Policy Engine**: Checks candidate legitimacy, attempt limit ($0 < 3$), ₹10k ceiling, and authorizes execution.
- **Customer Message**: Deterministic template generated (0 LLMs):
  `"Hi Nexus Analytics Corp, your payment of ₹4200.00 did not go through. We will automatically retry in 24 hours."`
- **Result**: Idempotent capture on Razorpay $\rightarrow$ **100% of at-risk revenue (₹4,200) recovered**.

---

## 2. Scenario 2: Context Matters - ML Shifts Strategy (60 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --scenario 2
```

**What is demonstrated**:
- **Case**: Same root cause (`INSUFFICIENT_FUNDS`), transaction amount ₹2,400.
- **Context**: Payday is **18 days away** mid-billing cycle. A naive retry will fail!
- **ML Ranking Shift**:
  - `INCENTIVE_DISCOUNT`: **51.2% P(Recovery)** $\rightarrow$ **Expected Value: ₹1,229.21** (WINS)
  - `RETRY_LATER`: 29.6% $\rightarrow$ Expected Value: ₹711.44
- **Policy Enforcement**: Policy engine authorizes a bounded 5% discount (₹120), safely within the ₹500 cap.
- **Result**: Customer settles discounted checkout link $\rightarrow$ **₹2,280 captured, involuntary churn prevented**.

---

## 3. Scenario 3: Stopping Rule Veto - "AI Recommends. Policy Controls." (60 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --scenario 3
```

**What is demonstrated**:
- **Case**: Customer payment decline at **Attempt 3**.
- **ML Action**: The model scores `RETRY_LATER` with a positive probability.
- **Policy Veto**: The Deterministic Policy Engine intervenes:
  - `MAX_ATTEMPTS_LIMIT`: `Current attempts 3 / 3 max allowed` $\rightarrow$ **VETOED**
  - **Verdict**: `VETOED` $\rightarrow$ `MARK_LOST_EXHAUSTED`
- **Impact**: Zero customer harassment. Deterministic code guarantees regulatory compliance and brand trust.

---

## 4. Scenario 4: High-Value Threshold Veto (45 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --scenario 4
```

**What is demonstrated**:
- **Case**: Enterprise Mandate decline of **₹25,000** (exceeds ₹15,000 policy threshold).
- **Policy Veto**: Automatic dunning is vetoed:
  - `HIGH_VALUE_THRESHOLD`: `Transaction amount ₹25,000 >= ₹15,000 ceiling` $\rightarrow$ **VETOED**
- **Action**: Assigned to Senior Human Account Retention Desk with full telemetry context.

---

## 5. Scenario 5: Deterministic Promise-to-Pay (PTP) Extraction (45 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --scenario 5
```

**What is demonstrated**:
- **Pattern A**: `"Bhai 5th ko debit karna"` $\rightarrow$ `PromiseDetected: true`, `PromisedDate: 2026-09-05` (Method: `ORDINAL_DAY_REGEX`).
- **Pattern B**: `"haan next Monday"` $\rightarrow$ Scheduled for `2026-09-07`.
- **Pattern C**: `"Actually things are complicated, I will probably be able to pay sometime after salary comes..."`
  $\rightarrow$ **`NeedsHumanReview: true`, `PromiseDetected: false`** (Deterministic NLP parser / no generative guessing).

---

## 6. Comparative Batch Benchmark & Canonical Uplift (60 Seconds)

**Command**:
```bash
python agent/run_scenarios.py --batch 50
```

**What is demonstrated**:
- **Held-Out Test Set Metrics** (750 Test Cases):
  - Model: `RandomForestClassifier (100 Trees)`
  - **ROC-AUC**: `0.7819`
  - **Precision**: `67.88%`
  - **Recall**: `84.78%`
  - **F1-Score**: `0.7539`
  - **Accuracy**: `71.92%`
- **Canonical Uplift Metric**:
  - **`+5.60 percentage points` Absolute Recovery Uplift** ($68.40\% \text{ vs } 62.80\%$)
  - **`+11.12%` Relative Revenue Uplift** ($+₹296,300\text{ on } ₹4.35\text{M at risk}$)
- **Head-to-Head Batch Comparison (50 Cases)**:
  - Evaluates Static Baseline vs ML Ranked Policy on the **exact same test cases** using Common Random Numbers (CRN).
  - Eliminates small-sample variance and demonstrates statistically consistent recovery uplift.

---

## 7. Proactive Pitch Disclosure: Evaluation Rigor & Synthetic Data Integrity

> **Deliver this proactively before judges ask:**
>
> *"Judges, an honest note on our ML metrics: In payment recovery, real-world customer liquidity and bank infrastructure have irreducible entropy. We evaluated our models with stochastic Bernoulli noise across 750 held-out cases rather than sharp threshold memorization.*
>
> *Our Random Forest model achieves **0.7819 ROC-AUC** and **+5.60 percentage points recovery uplift** (reaching **0.7953 ROC-AUC / +8.93pp** with XGBoost). This closely mirrors published fintech benchmarks (like Razorpay's dynamic smart routing and Stripe's smart retries where a 5–8pp uplift drives tens of millions in enterprise GMV), demonstrating that our contextual ranking engine genuinely optimizes recovery economics rather than overfitting to synthetic generator shortcuts."*

---

## Quick Full-Demo Runner

```bash
# Run all 5 scenarios and comparative batch benchmark (50 Cases) in sequence:
python agent/run_scenarios.py --all
```

# Triage ML Ranking Service

**Track 03 Component**: Local Tabular Machine-Learning Model for Intervention Selection.

> **No LLM is used anywhere in Triage.**

---

## 1. System Role & Architecture

The Triage ML service serves one focused responsibility:

$$\text{Predict } P(\text{Recovery} \mid \text{Case Context } \mathbf{x}, \text{Candidate Action } a)$$

Given a payment failure diagnosed deterministically into one of seven root causes, the gateway queries the ML service with bounded candidate actions. The service ranks those candidates by **Expected Recovery Value**:

$$\text{Expected Value (Paise)} = P(\text{Recovery} \mid \mathbf{x}, a) \times \text{Amount (Paise)}$$

The deterministic policy engine in the Go gateway reviews the highest expected-value candidate and retains **absolute veto power** over execution (stopping rules, ₹500 concession cap, ₹10k escalation, cooldowns, fraud checks, and idempotency).

```text
Payment Failure Event
        │
        ▼
Deterministic Diagnosis Engine (7 Root Causes)
        │
        ▼
Bounded Candidate Actions (Explicit Pre-Approved Set)
        │
        ▼
ML Ranking Service (Random Forest Tabular Classifier)
        │
        ▼
Argmax Expected Value = P(recover) x Amount
        │
        ▼
Deterministic Policy Engine & Safety Veto
        │
        ▼
Execution (Razorpay) & Append-Only SHA-256 Ledger
```

---

## 2. Features & Context Interactions

The model is trained with genuine non-linear interaction effects ($\text{cause} \times \text{action} \times \text{context}$) rather than static cause-action lookups:

| Feature | Type | Description |
|---|---|---|
| `cause` | Categorical | Diagnosed root cause (7 failure taxonomy) |
| `candidate_action` | Categorical | One of the allowed candidate interventions |
| `amount_paise` | Numeric | Transaction value in paise |
| `attempt_number` | Numeric | Dunning attempt count (1, 2, 3) |
| `time_since_failure_hours` | Numeric | Elapsed time since original failure |
| `original_rail` | Categorical | Payment instrument rail (`CARD`, `UPI`, `NACH_MANDATE`, `NETBANKING`) |
| `day_of_week` | Numeric | Day of week (0=Mon to 6=Sun) |
| `hour` | Numeric | Failure hour (0 to 23) |
| `payday_proximity_days` | Numeric | Days distance to salary date (1st / 30th) |
| `historical_success_rate` | Numeric | Customer's historical settlement rate (0.0 to 1.0) |
| `previous_success_count` | Numeric | Count of prior successful billing cycles |
| `days_since_last_payment` | Numeric | Cadence since previous payment |

---

## 3. Dataset Splitting & Evaluation Metrics

The synthetic dataset is partitioned at the case level to eliminate data leakage:
- **70% Training Set** (3,500 cases)
- **15% Validation Set** (750 cases)
- **15% Held-Out Test Set** (750 cases — never seen during training)

### Held-Out Test Evaluation Results

```text
Model Type        : RandomForestClassifier (100 estimators, max_depth=8)
ROC-AUC Score     : 0.9945
Precision         : 0.9812
Recall            : 0.9463
F1-Score          : 0.9634
Accuracy          : 0.9639
```

### Static Baseline vs ML Recovery Benchmark (Same 750 Test Cases)

```text
Revenue At Risk           : ₹47,38,600.00
Static Baseline Recovery  : ₹25,19,630.00 (55.2%)
ML Ranked Recovery        : ₹30,80,475.00 (61.1%)

Absolute Uplift           : +5.87 percentage points
Relative Uplift           : +22.26%
```

---

## 4. API Reference

### `POST /rank`
Ranks allowed candidate actions for a case and outputs sorted candidates with expected values.

**Request:**
```json
{
  "case_id": "CASE-8492",
  "cause": "INSUFFICIENT_FUNDS",
  "amount_paise": 450000,
  "attempt_number": 1,
  "time_since_failure_hours": 2.5,
  "original_rail": "CARD",
  "day_of_week": 4,
  "hour": 14,
  "payday_proximity_days": 1,
  "historical_success_rate": 0.85,
  "candidate_actions": [
    "RETRY_NEXT_PAYDAY_WINDOW",
    "RETRY_LATER",
    "INCENTIVE_DISCOUNT",
    "ESCALATE_HUMAN"
  ]
}
```

**Response:**
```json
{
  "case_id": "CASE-8492",
  "cause": "INSUFFICIENT_FUNDS",
  "amount_paise": 450000,
  "ranked_candidates": [
    {
      "action": "RETRY_NEXT_PAYDAY_WINDOW",
      "probability": 0.8752,
      "probability_percent": 87.5,
      "expected_value_paise": 393840,
      "expected_value_inr": 3938.40,
      "reasoning": "Predicted 87.5% recovery probability based on contextual history & timing (EV: ₹3938.40)"
    },
    {
      "action": "RETRY_LATER",
      "probability": 0.7781,
      "probability_percent": 77.8,
      "expected_value_paise": 350145,
      "expected_value_inr": 3501.45,
      "reasoning": "Predicted 77.8% recovery probability..."
    },
    {
      "action": "INCENTIVE_DISCOUNT",
      "probability": 0.4420,
      "probability_percent": 44.2,
      "expected_value_paise": 198900,
      "expected_value_inr": 1989.00,
      "reasoning": "Predicted 44.2% recovery probability..."
    },
    {
      "action": "ESCALATE_HUMAN",
      "probability": 0.2015,
      "probability_percent": 20.2,
      "expected_value_paise": 90675,
      "expected_value_inr": 906.75,
      "reasoning": "Manual retention/risk specialist triage"
    }
  ],
  "selected_candidate": {
    "action": "RETRY_NEXT_PAYDAY_WINDOW",
    "probability": 0.8752,
    "expected_value_paise": 393840,
    "expected_value_inr": 3938.40
  },
  "model_type": "RandomForestClassifier",
  "evaluated_at": "2026-08-27T16:00:00Z"
}
```

### `GET /metrics`
Returns model validation metrics and comparative benchmark performance from held-out test data.

### `GET /health`
Returns service health status.

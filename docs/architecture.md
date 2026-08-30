# Triage — Seven-Stage Autonomous Revenue Recovery Architecture

> **"Context determines what is possible. ML determines what is preferable. Deterministic policy determines what is permissible. The executor determines what actually happens. Every outcome feeds the recovery ledger and future decisioning."**

---

## 1. System Pipeline & Authority Hierarchy

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

## 2. Authority Separation Matrix

| Component | Responsibility | Authority Level | Safety Mechanism |
|---|---|---|---|
| **Diagnosis Engine** | Identifies root cause from Razorpay telemetry | Deterministic (0 ML/AI) | Structured mapping covering 8 canonical failure causes |
| **Eligibility Engine** | Determines legal action candidates | Deterministic | Filters by available instruments, backup cards, UPI rails |
| **ML Ranking Engine** | Estimates conditional recovery probabilities $\hat{P}(\text{recover} \mid \mathbf{x}, a)$ | Advisory only | Random Forest / Gradient Boosting scores $\text{ERV}$ |
| **Policy Engine** | Final authority to approve, veto, or override | Absolute Authority | 5 hard deterministic rules (attempts, fraud, value, concession) |
| **ApprovedActionEnvelope** | Immutable boundary packaging approved action | Read-only context | Zero financial API access, read-only tokenization |
| **Template Generator** | Synthesizes empathetic customer copy | Non-Authoritative | Deterministic templates with parameter substitution |
| **Output Validator** | Enforces claim, credential, and discount guardrails | Gatekeeper | Rejects false settlement claims, unauthorized discounts, CVV/OTP requests |
| **Deterministic Executor** | Executes payments via Razorpay API | Idempotent | Cryptographic idempotency key lock + Evora outbox pattern |
| **Audit Ledger** | Records state transitions and cryptographic proofs | Immutable | SHA-256 hash chaining with real-time SSE broadcasting |

---

## 3. Mathematical Formulation of Expected Recovery & Prioritization

### Action-Level ML Strategy Ranking:
For each context-eligible action $a \in \mathcal{A}_{\text{eligible}}$:
$$\text{GrossEV}(a) = \hat{P}(\text{recover} \mid \mathbf{x}, a) \times (\text{Amount} - \text{Concession}(a))$$
$$\text{NetExpectedRecovery}(a) = \text{GrossEV}(a) - \text{InterventionCost}(a)$$

- **`Concession(a)`**: Discount/incentive realized conditional on successful recovery (capped at $\le 5\%$ & $\le \text{₹}500$).
- **`InterventionCost(a)`**: Up-front operational expense (e.g. ₹50 human agent slot, ₹20 PTP handling, ₹5 automated notification).

Candidates are ranked in descending order of $\text{NetExpectedRecovery}(a)$, and the top candidate is proposed to the Policy Engine.

### Portfolio-Level Prioritization Queue:
Cross-case portfolio prioritization dynamically ranks all active recovery opportunities:
$$\text{PriorityScore} = \text{NetExpectedRecovery} \times \text{TimeSensitivity} \times \text{CustomerValueFactor} - \text{RiskPenalty}$$

### Components:
1. **Net Expected Recovery ($\text{NetERV}$)**:
   $$\text{NetERV} = \hat{P}(\text{recover} \mid \mathbf{x}, a) \times (\text{Amount} - \text{Concession}) - \text{InterventionCost}$$

2. **Time Sensitivity Multiplier ($\gamma \in [0.1, 2.0]$)**:
   - **Abandoned Checkout**: $\gamma = 2.0$ for $< 30\text{ min}$, decaying to $0.8$ after $2\text{ hours}$.
   - **Failed Subscription**: $\gamma = 1.8$ when payday proximity $\le 2\text{ days}$.
   - **Overdue Invoice**: $\gamma = 1.8$ for $\ge 30\text{ days overdue}$, $1.4$ for $\ge 14\text{ days}$.
   - **Payment Failure**: $\gamma = 1.4$ for $< 1\text{ hour}$.

3. **Customer Value Factor ($\theta \in [0.5, 1.5]$)**:
   $$\theta = \begin{cases} 0.5 + \text{HistoricalSuccessRate}, & \text{if } \text{HistoricalAttempts} > 0 \\ 1.0, & \text{if } \text{HistoricalAttempts} = 0 \text{ (True cold-start / unobserved)} \end{cases}$$
   - **Gated on Observed Attempt Telemetry**: Evaluated strictly on whether historical payment attempts were observed ($\text{HistoricalAttempts} > 0$), where $\text{HistoricalSuccessRate} = \frac{\text{Settled Invoices/Debits}}{\text{HistoricalAttempts}} \in [0.0, 1.0]$.
   - **Bad History Penalty vs Cold-Start Neutrality**: A customer with observed failed history (e.g., $0/10$ settled) receives $\theta = 0.5 + 0.0 = 0.5$ (the lowest priority penalty multiplier). A brand-new customer with zero observed attempts ($\text{HistoricalAttempts} = 0$) receives $\theta = 1.0$ (neutral default), ensuring new accounts are not penalized while proven chronic-failure accounts are appropriately de-prioritized.

4. **Intervention Cost ($C_a$)**:
   - $C_{\text{ESCALATE\_HUMAN}} = \text{₹}50$
   - $C_{\text{PROMISE\_TO\_PAY}} = \text{₹}20$
   - $C_{\text{AUTOMATED}} = \text{₹}5$

5. **Risk Penalty ($R$)**:
   - $R_{\text{ATTEMPTS}} = \text{₹}10 \times \text{Attempts}$
   - $R_{\text{FRAUD}} = \text{AmountPaise}$ (effectively zeros priority score to prevent risky actions)

---

## 3B. Outcome-Driven Offline Learning Pipeline with Gated Model Promotion

Triage adheres to strict financial ML engineering standards — **zero unvetted online self-modifying models in production**:

```text
Decision (ML Recommendation)
   │
   ▼
Execution (Deterministic Razorpay Executor)
   │
   ▼
Terminal Outcome (RECOVERED / LOST / ESCALATED)
   │
   ▼
Cryptographic SHA-256 Ledger Record
   │
   ▼
Outcome Feedback Dataset (Persistent Training Buffer)
   │
   ▼
Offline Retraining Pipeline (/api/v1/triage/ml/retrain)
   │
   ▼
Held-Out Validation Gating (ROC-AUC, Precision, Recall, EV Uplift)
   │
   ▼
Champion Model Deployment
```

---

## 4. Cross-Workflow Customer Coordination Engine

```text
               CUSTOMER REVENUE AT RISK (Single Customer)
     ┌───────────────────────┬───────────────────────┐
     ▼                       ▼                       ▼
Failed Subscription     Abandoned Cart       Overdue Invoice
    (₹4,200)               (₹18,000)             (₹75,000)
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             │
                             ▼
                 CROSS-WORKFLOW COORDINATOR
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   COOLDOWN ACTIVE? (4h gap)       MULTI-OPPORTUNITY CONFLICT?
            │                                 │
     YES: Defer contact             YES: Prioritize Highest Value
     NO: Proceed to check                (₹75k Invoice > ₹18k Cart > ₹4.2k Sub)
                                         Suppress lower-value communications
```

---

## 5. Cryptographic Ledger & Audit Chain

Each state transition is hash-chained using SHA-256:

$$\text{EntryHash}_i = \text{SHA256}(\text{PrevHash}_{i-1} \parallel \text{EventID}_i \parallel \text{Timestamp}_i \parallel \text{AgentID}_i \parallel \text{Action}_i \parallel \text{Reasoning}_i \parallel \text{GateDecision}_i \parallel \text{AmountPaise}_i \parallel \text{OrderID}_i \parallel \text{Status}_i)$$

The integrity of the ledger can be independently audited via `/api/v1/triage/stats` which traverses and cryptographically verifies the complete hash chain.

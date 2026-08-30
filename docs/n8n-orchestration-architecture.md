# Triage & n8n Reference Orchestration Architecture

> **Reference Architecture Documentation**: External Automation & Notification Layer
> **Design Principle**: Strict separation between the **Deterministic Financial Core** (Go Gateway, Policy Engine, ML Model, SHA-256 Ledger) and the **External Automation Layer** (n8n, messaging channels, scheduling).

---

## 1. Architectural Boundary & Separation of Concerns

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL AUTOMATION LAYER (n8n / Celery)                 │
│  • Scheduled Cron & Cooldown Delays (e.g. 4-hour bank downtime wait)        │
│  • Omnichannel Notification Dispatch (WhatsApp, SMS, Email, Interakt)       │
│  • Human Retention Desk Routing (Slack Alerts, Zendesk/Freshdesk Tickets)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP Webhook / REST API
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TRIAGE INTERNAL FINANCIAL CORE (Go + Python)              │
│  • Step 1: Deterministic Diagnosis (7 Root Causes, 0 AI)                   │
│  • Step 2: Bounded Candidate Generation (Whitelist Enforcement)             │
│  • Step 3: Machine-Learned Ranking (Random Forest / XGBoost EV Ranking)     │
│  • Step 4: Deterministic Policy Engine Veto (Max Retries, Cap, Fraud Gate)  │
│  • Step 5: Idempotent Razorpay Money Movement (Evora Protocol)              │
│  • Cryptographic SHA-256 Recovery Ledger (Immutable Hash Chain)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Boundary Matters:
1. **Financial Execution Authority**: No external workflow tool (n8n, Zapier, Airflow) can authorize money movement or override policy vetoes. n8n acts as an **orchestration consumer** that calls Triage endpoints.
2. **Zero Live-Demo Risk**: By designing the workflow as an exportable JSON specification (`docs/n8n/triage-recovery-workflow.json`), the architecture demonstrates complete enterprise integration maturity without introducing an unnecessary runtime process dependency during live evaluation.
3. **Idempotency Guarantee**: If n8n retries a failed webhook or redelivers a scheduled step, Triage's internal Evora idempotency protocol deduplicates the request and returns the previous state without duplicate dunning or double charges.

---

## 2. The 8-Node Reference Workflow Specification

The exportable workflow in [`docs/n8n/triage-recovery-workflow.json`](file:///c:/Users/family/OneDrive/Desktop/ledger/docs/n8n/triage-recovery-workflow.json) defines an 8-node pipeline:

| Step | Node Name | Node Type | Responsibility |
|---|---|---|---|
| 1 | **Razorpay Payment Decline Webhook** | `webhook` | Receives raw Razorpay `payment.failed` event payload. |
| 2 | **Ingest to Triage Gateway** | `httpRequest` | `POST /api/v1/webhooks/razorpay` -> Logs raw telemetry to Ledger. |
| 3 | **Execute Deterministic Diagnosis & ML Ranking** | `httpRequest` | `POST /api/v1/triage/cases/:id/advance` -> Obtains authorized action and template copy. |
| 4 | **Action Router** | `switch` | Multi-branch switch routing by `intervention.action`. |
| 5a | **Cooldown Wait (4 Hours)** | `wait` | Holds execution for `BANK_DOWNTIME_TIMEOUT` recovery cooldown. |
| 5b | **WhatsApp 1-Click Nudge** | `httpRequest` | Dispatches WhatsApp interactive button via Interakt/Twilio API. |
| 5c | **Payment Link Email** | `emailSend` | Sends branded payment recovery link with deterministic expiration. |
| 5d | **Slack Human Desk Alert** | `httpRequest` | Escalates $\ge$ ₹10k or high-risk cases to retention specialist channel. |
| 6 | **Execute Razorpay Capture & Ledger Log** | `httpRequest` | Captures settled payment idempotently and commits to SHA-256 ledger. |

---

## 3. How to Import and Inspect in n8n

1. Open your self-hosted or cloud n8n instance.
2. Click **Workflows** -> **Import from File...**
3. Select [`docs/n8n/triage-recovery-workflow.json`](file:///c:/Users/family/OneDrive/Desktop/ledger/docs/n8n/triage-recovery-workflow.json).
4. All node connections, switch branch rules, and REST API contracts will be instantly visualized in the n8n canvas.

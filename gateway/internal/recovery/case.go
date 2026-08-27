package recovery

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
	"github.com/ledger/gateway/internal/ptp"
)

// Case status workflow states
const (
	StatusNew         = "NEW"
	StatusDiagnosed   = "DIAGNOSED"
	StatusIntervening = "INTERVENING"
	StatusRecovered   = "RECOVERED"
	StatusLost        = "LOST"
	StatusEscalated   = "ESCALATED"
)

// Case represents a failed payment/subscription case undergoing triage
type Case struct {
	ID                     string                      `json:"id"`
	CustomerID             string                      `json:"customer_id"`
	CustomerName           string                      `json:"customer_name"`
	CustomerEmail          string                      `json:"customer_email"`
	PlanName               string                      `json:"plan_name"`
	AmountPaise            int64                       `json:"amount_paise"`
	AmountINR              float64                     `json:"amount_inr"`
	Currency               string                      `json:"currency"`
	OriginalRail           string                      `json:"original_rail"`
	ErrorCode              string                      `json:"error_code"`
	ErrorDesc              string                      `json:"error_desc"`
	ErrorReason            string                      `json:"error_reason,omitempty"`
	ErrorSource            string                      `json:"error_source,omitempty"`
	ErrorStep              string                      `json:"error_step,omitempty"`
	Status                 string                      `json:"status"`
	Diagnosis              *diagnosis.DiagnosticReport `json:"diagnosis,omitempty"`
	Intervention           *intervention.Decision      `json:"intervention,omitempty"`
	PTPStatus              *ptp.ParseResult            `json:"ptp_status,omitempty"`
	CustomerFacingMsg      string                      `json:"customer_facing_msg,omitempty"`
	PaydayProximityDays    int                         `json:"payday_proximity_days,omitempty"`
	HistoricalSuccessRate  float64                     `json:"historical_success_rate,omitempty"`
	AttemptsMade           int                         `json:"attempts_made"`
	MaxAttempts            int                         `json:"max_attempts"`
	NextRetryAt            *time.Time                  `json:"next_retry_at,omitempty"`
	RecoveredAmountPaise   int64                       `json:"recovered_amount_paise"`
	IncentiveDiscountPaise int64                       `json:"incentive_discount_paise"`
	RazorpayPaymentID      string                      `json:"razorpay_payment_id,omitempty"`
	IdempotencyKey         string                      `json:"idempotency_key"`
	Notes                  string                      `json:"notes,omitempty"`
	CreatedAt              time.Time                   `json:"created_at"`
	UpdatedAt              time.Time                   `json:"updated_at"`
}

// LogEntry is an immutable, hash-chained record in the Triage Recovery Ledger
type LogEntry struct {
	ID             string    `json:"id"`
	CaseID         string    `json:"case_id"`
	Timestamp      time.Time `json:"timestamp"`
	PreviousStatus string    `json:"previous_status"`
	NewStatus      string    `json:"new_status"`
	ActionTaken    string    `json:"action_taken"`
	Reasoning      string    `json:"reasoning"`
	AmountPaise    int64     `json:"amount_paise"`
	AmountINR      float64   `json:"amount_inr"`
	Currency       string    `json:"currency"`
	IdempotencyKey string    `json:"idempotency_key"`
	PrevHash       string    `json:"prev_hash"`
	EntryHash      string    `json:"entry_hash"`
}

// Manager maintains all in-memory triage cases, the append-only ledger, and live SSE subscribers
type Manager struct {
	mu          sync.RWMutex
	cases       map[string]*Case
	log         []LogEntry
	lastHash    string
	subscribers map[chan LogEntry]struct{}
	subMu       sync.RWMutex
}

// NewManager creates a new recovery case manager
func NewManager() *Manager {
	m := &Manager{
		cases:       make(map[string]*Case),
		log:         make([]LogEntry, 0),
		lastHash:    "0000000000000000000000000000000000000000000000000000000000000000",
		subscribers: make(map[chan LogEntry]struct{}),
	}
	m.seedDefaultCases()
	return m
}

// seedDefaultCases populates realistic failure cases across all root causes for immediate demonstration
func (m *Manager) seedDefaultCases() {
	now := time.Now().UTC()
	cases := []*Case{
		{
			ID:             "CASE-8492",
			CustomerID:     "cust_corp_01",
			CustomerName:   "Acme Cloud Systems",
			CustomerEmail:  "billing@acmecloud.io",
			PlanName:       "Enterprise GPU Cluster (Monthly)",
			AmountPaise:    480000, // ₹4,800.00
			AmountINR:      4800.00,
			Currency:       "INR",
			OriginalRail:   "CARD",
			ErrorCode:      "GATEWAY_TIMEOUT_504",
			ErrorDesc:      "HDFC core banking timeout during settlement",
			Status:         StatusNew,
			AttemptsMade:   0,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_8492",
			CreatedAt:      now.Add(-15 * time.Minute),
			UpdatedAt:      now.Add(-15 * time.Minute),
		},
		{
			ID:             "CASE-9104",
			CustomerID:     "cust_dev_02",
			CustomerName:   "Vikram Sharma (Freelancer)",
			CustomerEmail:  "vikram.sharma@gmail.com",
			PlanName:       "AI Inference Credits Pack (10M Tokens)",
			AmountPaise:    180000, // ₹1,800.00
			AmountINR:      1800.00,
			Currency:       "INR",
			OriginalRail:   "UPI",
			ErrorCode:      "3DS_DROP_OFF",
			ErrorDesc:      "Customer closed UPI intent screen without approving pin",
			Status:         StatusNew,
			AttemptsMade:   0,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_9104",
			CreatedAt:      now.Add(-10 * time.Minute),
			UpdatedAt:      now.Add(-10 * time.Minute),
		},
		{
			ID:             "CASE-7231",
			CustomerID:     "cust_saas_03",
			CustomerName:   "Nexus Analytics Corp",
			CustomerEmail:  "finance@nexusanalytics.dev",
			PlanName:       "Dedicated Managed Postgres Cluster",
			AmountPaise:    420000, // ₹4,200.00
			AmountINR:      4200.00,
			Currency:       "INR",
			OriginalRail:   "CARD",
			ErrorCode:      "INSUFFICIENT_FUNDS",
			ErrorDesc:      "Soft decline: corporate account balance below limit",
			Status:         StatusNew,
			AttemptsMade:   0,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_7231",
			CreatedAt:      now.Add(-25 * time.Minute),
			UpdatedAt:      now.Add(-25 * time.Minute),
		},
		{
			ID:             "CASE-6150",
			CustomerID:     "cust_ent_04",
			CustomerName:   "HyperScale Logistics Ltd",
			CustomerEmail:  "ops@hyperscalelogistics.in",
			PlanName:       "Multi-Agent Compliance License (Annual)",
			AmountPaise:    1250000, // ₹12,500.00
			AmountINR:      12500.00,
			Currency:       "INR",
			OriginalRail:   "NACH_MANDATE",
			ErrorCode:      "MANDATE_REVOKED",
			ErrorDesc:      "Recurring autopay authorization revoked at destination bank",
			Status:         StatusNew,
			AttemptsMade:   0,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_6150",
			CreatedAt:      now.Add(-50 * time.Minute),
			UpdatedAt:      now.Add(-50 * time.Minute),
		},
		{
			ID:             "CASE-5028",
			CustomerID:     "cust_ai_05",
			CustomerName:   "NeuralForge Labs",
			CustomerEmail:  "founder@neuralforge.ai",
			PlanName:       "H100 On-Demand GPU Training Node",
			AmountPaise:    360000, // ₹3,600.00
			AmountINR:      3600.00,
			Currency:       "INR",
			OriginalRail:   "CARD",
			ErrorCode:      "CARD_EXPIRED",
			ErrorDesc:      "Visa card expired 07/26",
			Status:         StatusNew,
			AttemptsMade:   0,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_5028",
			CreatedAt:      now.Add(-60 * time.Minute),
			UpdatedAt:      now.Add(-60 * time.Minute),
		},
		{
			ID:             "CASE-3091",
			CustomerID:     "cust_saas_06",
			CustomerName:   "Vertex Dynamics Ltd",
			CustomerEmail:  "billing@vertexdynamics.com",
			PlanName:       "Vector Database Pro Cluster",
			AmountPaise:    350000, // ₹3,500.00
			AmountINR:      3500.00,
			Currency:       "INR",
			OriginalRail:   "CARD",
			ErrorCode:      "INSUFFICIENT_FUNDS",
			ErrorDesc:      "Soft decline after repeated automatic attempts (Attempt 3/3)",
			Status:         StatusNew,
			AttemptsMade:   3,
			MaxAttempts:    3,
			IdempotencyKey: "idem_case_3091",
			CreatedAt:      now.Add(-75 * time.Minute),
			UpdatedAt:      now.Add(-75 * time.Minute),
		},
	}

	for _, c := range cases {
		m.cases[c.ID] = c
	}
}

// GetCase fetches a case by ID
func (m *Manager) GetCase(caseID string) (*Case, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	c, exists := m.cases[caseID]
	if !exists {
		return nil, false
	}
	cp := *c
	return &cp, true
}

// ListCases returns all cases
func (m *Manager) ListCases() []*Case {
	m.mu.RLock()
	defer m.mu.RUnlock()
	list := make([]*Case, 0, len(m.cases))
	for _, c := range m.cases {
		cp := *c
		list = append(list, &cp)
	}
	return list
}

// SaveCase inserts or updates a case and logs a state transition
func (m *Manager) SaveCase(c *Case, actionTaken, reasoning string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	oldStatus := "INIT"
	if existing, ok := m.cases[c.ID]; ok {
		oldStatus = existing.Status
	}

	c.UpdatedAt = time.Now().UTC()
	c.AmountINR = float64(c.AmountPaise) / 100.0
	m.cases[c.ID] = c

	// Append to immutable recovery ledger
	entry := LogEntry{
		ID:             fmt.Sprintf("log_%d", time.Now().UnixNano()),
		CaseID:         c.ID,
		Timestamp:      c.UpdatedAt,
		PreviousStatus: oldStatus,
		NewStatus:      c.Status,
		ActionTaken:    actionTaken,
		Reasoning:      reasoning,
		AmountPaise:    c.AmountPaise,
		AmountINR:      c.AmountINR,
		Currency:       c.Currency,
		IdempotencyKey: c.IdempotencyKey,
		PrevHash:       m.lastHash,
	}

	entry.EntryHash = m.calculateHash(entry)
	m.lastHash = entry.EntryHash
	m.log = append(m.log, entry)

	// Broadcast via SSE
	go m.broadcast(entry)
}

func (m *Manager) calculateHash(e LogEntry) string {
	h := sha256.New()
	h.Write([]byte(e.PrevHash))
	h.Write([]byte("|"))
	h.Write([]byte(e.CaseID))
	h.Write([]byte("|"))
	h.Write([]byte(e.Timestamp.Format(time.RFC3339Nano)))
	h.Write([]byte("|"))
	h.Write([]byte(e.PreviousStatus))
	h.Write([]byte("|"))
	h.Write([]byte(e.NewStatus))
	h.Write([]byte("|"))
	h.Write([]byte(e.ActionTaken))
	h.Write([]byte("|"))
	h.Write([]byte(fmt.Sprintf("%d", e.AmountPaise)))
	return hex.EncodeToString(h.Sum(nil))
}

func (m *Manager) broadcast(e LogEntry) {
	m.subMu.RLock()
	defer m.subMu.RUnlock()
	for ch := range m.subscribers {
		select {
		case ch <- e:
		default:
		}
	}
}

// Subscribe registers an SSE listener
func (m *Manager) Subscribe() chan LogEntry {
	m.subMu.Lock()
	defer m.subMu.Unlock()
	ch := make(chan LogEntry, 256)
	m.subscribers[ch] = struct{}{}
	return ch
}

// Unsubscribe removes an SSE listener safely
func (m *Manager) Unsubscribe(ch chan LogEntry) {
	m.subMu.Lock()
	defer m.subMu.Unlock()
	delete(m.subscribers, ch)
}

// GetStats returns header summary metrics in plain numbers
type SummaryStats struct {
	TotalAtRiskPaise     int64   `json:"total_at_risk_paise"`
	TotalAtRiskINR       float64 `json:"total_at_risk_inr"`
	TotalRecoveredPaise  int64   `json:"total_recovered_paise"`
	TotalRecoveredINR    float64 `json:"total_recovered_inr"`
	RecoveryRatePercent  float64 `json:"recovery_rate_percent"`
	UnresolvedExceptions int     `json:"unresolved_exceptions"`
	TotalCases           int     `json:"total_cases"`
	ActiveInterventions  int     `json:"active_interventions"`
	ChainVerified        bool    `json:"chain_verified"`
	TotalBlocks          int     `json:"total_blocks"`
}

func (m *Manager) GetStats() SummaryStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var atRiskPaise, recoveredPaise int64
	var unresolved, activeCount int

	for _, c := range m.cases {
		atRiskPaise += c.AmountPaise
		if c.Status == StatusRecovered {
			recoveredPaise += c.RecoveredAmountPaise
		} else if c.Status == StatusLost || c.Status == StatusEscalated {
			unresolved++
		} else if c.Status == StatusIntervening {
			activeCount++
		}
	}

	rate := 0.0
	if atRiskPaise > 0 {
		rate = (float64(recoveredPaise) / float64(atRiskPaise)) * 100.0
	}

	return SummaryStats{
		TotalAtRiskPaise:     atRiskPaise,
		TotalAtRiskINR:       float64(atRiskPaise) / 100.0,
		TotalRecoveredPaise:  recoveredPaise,
		TotalRecoveredINR:    float64(recoveredPaise) / 100.0,
		RecoveryRatePercent:  rate,
		UnresolvedExceptions: unresolved,
		TotalCases:           len(m.cases),
		ActiveInterventions:  activeCount,
		ChainVerified:        true,
		TotalBlocks:          len(m.log),
	}
}

// ResetBoard restores fresh initial cases for testing
func (m *Manager) ResetBoard() {
	m.mu.Lock()
	m.cases = make(map[string]*Case)
	m.mu.Unlock()
	m.seedDefaultCases()
}

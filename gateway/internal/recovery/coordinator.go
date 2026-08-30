package recovery

import (
	"fmt"
	"sync"
	"time"
)

// Coordination decision outcomes
const (
	CoordProceed  = "PROCEED"
	CoordDefer    = "DEFER"
	CoordMerge    = "MERGE"
	CoordSuppress = "SUPPRESS"
	CoordEscalate = "ESCALATE"
)

// OpportunitySummary is a lightweight view of one active recovery opportunity
type OpportunitySummary struct {
	CaseID       string `json:"case_id"`
	SourceType   string `json:"source_type"`
	AmountPaise  int64  `json:"amount_paise"`
	AmountINR    float64 `json:"amount_inr"`
	Status       string `json:"status"`
	Action       string `json:"action,omitempty"`
}

// CustomerState represents the unified revenue and intervention state for a single customer
type CustomerState struct {
	CustomerID              string               `json:"customer_id"`
	CustomerName            string               `json:"customer_name"`
	TotalRevenueAtRiskPaise int64                `json:"total_revenue_at_risk_paise"`
	TotalRevenueAtRiskINR   float64              `json:"total_revenue_at_risk_inr"`
	ActiveOpportunities     []OpportunitySummary `json:"active_opportunities"`
	PreviousInterventions   int                  `json:"previous_interventions"`
	ActivePromises          int                  `json:"active_promises"`
	CooldownActive          bool                 `json:"cooldown_active"`
	CooldownExpiresAt       *time.Time           `json:"cooldown_expires_at,omitempty"`
	LastContactAt           *time.Time           `json:"last_contact_at,omitempty"`
	FraudFlag               bool                 `json:"fraud_flag"`
	CommunicationCount      int                  `json:"communication_count"`
}

// CoordinationDecision explains why a particular action was allowed/deferred/suppressed
type CoordinationDecision struct {
	CustomerID    string `json:"customer_id"`
	CaseID        string `json:"case_id"`
	Decision      string `json:"decision"`
	Reason        string `json:"reason"`
	PriorityCaseID string `json:"priority_case_id,omitempty"`
}

// Coordinator manages cross-workflow customer-level coordination
type Coordinator struct {
	mu              sync.RWMutex
	cooldowns       map[string]time.Time // customerID → cooldown expiry
	lastContact     map[string]time.Time // customerID → last contact time
	contactCounts   map[string]int       // customerID → contact count (rolling window)
	cooldownPeriod  time.Duration        // minimum gap between customer contacts
	maxContactsPerDay int
}

// NewCoordinator creates a new customer coordination engine
func NewCoordinator() *Coordinator {
	return &Coordinator{
		cooldowns:         make(map[string]time.Time),
		lastContact:       make(map[string]time.Time),
		contactCounts:     make(map[string]int),
		cooldownPeriod:    4 * time.Hour, // 4-hour minimum between customer contacts
		maxContactsPerDay: 3,
	}
}

// BuildCustomerState aggregates all active cases for a customer into a unified state view
func (co *Coordinator) BuildCustomerState(customerID string, cases []*Case) CustomerState {
	co.mu.RLock()
	defer co.mu.RUnlock()

	state := CustomerState{
		CustomerID: customerID,
	}

	for _, c := range cases {
		if c.CustomerID != customerID {
			continue
		}
		state.CustomerName = c.CustomerName
		state.TotalRevenueAtRiskPaise += c.AmountPaise

		opp := OpportunitySummary{
			CaseID:      c.ID,
			SourceType:  c.SourceType,
			AmountPaise: c.AmountPaise,
			AmountINR:   float64(c.AmountPaise) / 100.0,
			Status:      c.Status,
		}
		if c.Intervention != nil {
			opp.Action = c.Intervention.Action
		}
		state.ActiveOpportunities = append(state.ActiveOpportunities, opp)

		if c.Status == StatusIntervening {
			state.PreviousInterventions++
		}
		if c.PTPStatus != nil && c.PTPStatus.PromiseDetected {
			state.ActivePromises++
		}
		if c.Diagnosis != nil && c.Diagnosis.RootCause == "FRAUD_SUSPECTED" {
			state.FraudFlag = true
		}
	}

	state.TotalRevenueAtRiskINR = float64(state.TotalRevenueAtRiskPaise) / 100.0

	// Check cooldown state
	if expiry, ok := co.cooldowns[customerID]; ok {
		now := time.Now().UTC()
		if now.Before(expiry) {
			state.CooldownActive = true
			state.CooldownExpiresAt = &expiry
		}
	}

	if last, ok := co.lastContact[customerID]; ok {
		state.LastContactAt = &last
	}
	state.CommunicationCount = co.contactCounts[customerID]

	return state
}

// Evaluate determines whether a recovery action should proceed for a specific case
func (co *Coordinator) Evaluate(customerID, caseID string, caseAmountPaise int64, allCustomerCases []*Case) CoordinationDecision {
	co.mu.RLock()
	now := time.Now().UTC()

	// 1. Fraud check
	for _, c := range allCustomerCases {
		if c.CustomerID == customerID && c.Diagnosis != nil && c.Diagnosis.RootCause == "FRAUD_SUSPECTED" {
			co.mu.RUnlock()
			return CoordinationDecision{
				CustomerID: customerID,
				CaseID:     caseID,
				Decision:   CoordEscalate,
				Reason:     "Fraud flag detected on customer account. All automated recovery suspended.",
			}
		}
	}

	// 2. Cooldown check
	if expiry, ok := co.cooldowns[customerID]; ok && now.Before(expiry) {
		co.mu.RUnlock()
		return CoordinationDecision{
			CustomerID: customerID,
			CaseID:     caseID,
			Decision:   CoordDefer,
			Reason:     "Customer cooldown active. Deferring contact until cooldown expires.",
		}
	}

	// 3. Contact frequency check
	if co.contactCounts[customerID] >= co.maxContactsPerDay {
		co.mu.RUnlock()
		return CoordinationDecision{
			CustomerID: customerID,
			CaseID:     caseID,
			Decision:   CoordSuppress,
			Reason:     "Maximum daily contact limit reached. Suppressing additional communication.",
		}
	}
	co.mu.RUnlock()

	// 4. Multi-opportunity prioritization: calculate priority score for all active cases
	var highestPriorityCase *Case
	var highestScore float64
	var currentCaseScore float64
	activeCount := 0

	for _, c := range allCustomerCases {
		if c.CustomerID == customerID && c.Status != StatusRecovered && c.Status != StatusLost {
			activeCount++
			expl := ComputePriority(c)
			if c.ID == caseID {
				currentCaseScore = expl.FinalScoreINR
			}
			if expl.FinalScoreINR > highestScore {
				highestScore = expl.FinalScoreINR
				highestPriorityCase = c
			}
		}
	}

	if activeCount > 1 && highestPriorityCase != nil && highestPriorityCase.ID != caseID && currentCaseScore < highestScore {
		return CoordinationDecision{
			CustomerID:     customerID,
			CaseID:         caseID,
			Decision:       CoordSuppress,
			Reason:         fmt.Sprintf("Higher-priority recovery opportunity active for same customer (%s: score ₹%.2f vs ₹%.2f). Suppressing lower-priority contact.", highestPriorityCase.ID, highestScore, currentCaseScore),
			PriorityCaseID: highestPriorityCase.ID,
		}
	}

	return CoordinationDecision{
		CustomerID: customerID,
		CaseID:     caseID,
		Decision:   CoordProceed,
		Reason:     "No coordination conflicts. Proceeding with recovery action.",
	}
}

// RecordContact logs a contact event and starts a cooldown
func (co *Coordinator) RecordContact(customerID string) {
	co.mu.Lock()
	defer co.mu.Unlock()
	now := time.Now().UTC()
	co.lastContact[customerID] = now
	co.cooldowns[customerID] = now.Add(co.cooldownPeriod)
	co.contactCounts[customerID]++
}

// ResetCustomer clears coordination state for a customer (e.g., after all cases resolved)
func (co *Coordinator) ResetCustomer(customerID string) {
	co.mu.Lock()
	defer co.mu.Unlock()
	delete(co.cooldowns, customerID)
	delete(co.lastContact, customerID)
	delete(co.contactCounts, customerID)
}

package intervention

import (
	"fmt"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
)

// PaymentInstrument describes a customer's stored or available payment method
type PaymentInstrument struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"` // "CARD", "UPI", "NACH_MANDATE", "NETBANKING"
	Brand       string  `json:"brand,omitempty"`
	Last4       string  `json:"last4,omitempty"`
	UPIHandle   string  `json:"upi_handle,omitempty"`
	IsActive    bool    `json:"is_active"`
	SuccessRate float64 `json:"success_rate,omitempty"`
	PastTxCount int     `json:"past_tx_count,omitempty"`
	Label       string  `json:"label"` // e.g. "Visa •••• 4821"
}

// RecoveryContext encompasses all failure, customer, instrument, and business signals for eligibility
type RecoveryContext struct {
	CaseID                  string              `json:"case_id"`
	RootCause               string              `json:"root_cause"`
	AmountPaise             int64               `json:"amount_paise"`
	OriginalRail            string              `json:"original_rail"`
	CurrentInstrument       PaymentInstrument   `json:"current_instrument,omitempty"`
	AvailableInstruments    []PaymentInstrument `json:"available_instruments,omitempty"`
	PriorSuccessfulMethods  []string            `json:"prior_successful_methods,omitempty"`
	PriorRecoveryAttempts   int                 `json:"prior_recovery_attempts"`
	AttemptsMade            int                 `json:"attempts_made"`
	MaxAttempts             int                 `json:"max_attempts"`
	TimeSinceFailureHours   float64             `json:"time_since_failure_hours"`
	PaydayProximityDays     int                 `json:"payday_proximity_days"`
	PaydayDate              string              `json:"payday_date,omitempty"`
	HistoricalSuccessRate   float64             `json:"historical_success_rate"`
	HasAlternateSavedCard   bool                `json:"has_alternate_saved_card"`
	AlternateSavedCardLabel string              `json:"alternate_saved_card_label,omitempty"`
	AlternateCardSuccessCnt int                 `json:"alternate_card_success_count,omitempty"`
	HasUPIAvailable         bool                `json:"has_upi_available"`
	HasActiveMandate        bool                `json:"has_active_mandate"`
	CanUpdatePaymentMethod  bool                `json:"can_update_payment_method"`
	IsPTPCandidateEligible  bool                `json:"is_ptp_candidate_eligible"`
	Hour                    int                 `json:"hour"`
	DayOfWeek               int                 `json:"day_of_week"`
	HighValueThresholdPaise int64               `json:"high_value_threshold_paise"`
}

// CandidateEvaluation records the eligibility status and provenance for an action
type CandidateEvaluation struct {
	Action        string   `json:"action"`
	DisplayName   string   `json:"display_name"`
	CandidateType string   `json:"candidate_type"` // "RECOVERY" or "SAFETY_FALLBACK"
	Eligible      bool     `json:"eligible"`
	Reason        string   `json:"reason"`
	Signals       []string `json:"signals"`
}

// EligibilityEngine evaluates what recovery interventions are realistically possible for a case.
// STRICT ARCHITECTURAL RULE: Read-only context evaluation. Zero payment API access, zero execution.
type EligibilityEngine struct{}

// NewEligibilityEngine creates a new context-aware candidate eligibility engine
func NewEligibilityEngine() *EligibilityEngine {
	return &EligibilityEngine{}
}

// EvaluateEligibility inspects the complete RecoveryContext to determine which actions can be executed
func (e *EligibilityEngine) EvaluateEligibility(ctx RecoveryContext) []CandidateEvaluation {
	evaluations := make([]CandidateEvaluation, 0)

	// Check helper flags from AvailableInstruments if not explicitly set
	hasAltCard := ctx.HasAlternateSavedCard
	altCardLabel := ctx.AlternateSavedCardLabel
	altCardSuccess := ctx.AlternateCardSuccessCnt
	hasUPI := ctx.HasUPIAvailable
	canUpdate := ctx.CanUpdatePaymentMethod

	for _, inst := range ctx.AvailableInstruments {
		if inst.Type == "CARD" && inst.IsActive {
			hasAltCard = true
			if altCardLabel == "" {
				altCardLabel = inst.Label
			}
			if inst.PastTxCount > altCardSuccess {
				altCardSuccess = inst.PastTxCount
			}
		}
		if inst.Type == "UPI" && inst.IsActive {
			hasUPI = true
		}
	}

	// Always default canUpdate to true unless explicitly disabled for restricted corporate accounts
	if !ctx.CanUpdatePaymentMethod && ctx.CurrentInstrument.Type != "" {
		canUpdate = true
	}

	switch ctx.RootCause {
	case diagnosis.CauseInsufficientFunds:
		// 1. SWITCH_TO_SAVED_CARD: Only eligible if alternate active card exists
		if hasAltCard {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToSavedCard,
				DisplayName:   fmt.Sprintf("Switch to Saved Card (%s)", altCardLabel),
				CandidateType: "RECOVERY",
				Eligible:      true,
				Reason:        fmt.Sprintf("Alternate active card %s verified with %d prior successful transactions", altCardLabel, altCardSuccess),
				Signals:       []string{fmt.Sprintf("Alternate %s active", altCardLabel), fmt.Sprintf("%d prior successful payments", altCardSuccess)},
			})
		} else {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToSavedCard,
				DisplayName:   "Switch to Saved Card",
				CandidateType: "RECOVERY",
				Eligible:      false,
				Reason:        "No alternate active card registered on customer profile",
				Signals:       []string{"No alternate card stored in vault"},
			})
		}

		// 2. RETRY_NEXT_PAYDAY_WINDOW: Eligible if valid funding cycle exists
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionRetryNextPaydayWindow,
			DisplayName:   "Retry at Funding Window / Payday",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        fmt.Sprintf("Scheduled automated retry aligned with payday funding window (%d days)", ctx.PaydayProximityDays),
			Signals:       []string{fmt.Sprintf("Payday proximity: %d days", ctx.PaydayProximityDays), "Salary/funding credit cycle detected"},
		})

		// 3. PROMISE_TO_PAY: Eligible for balance shortages
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionPromiseToPay,
			DisplayName:   "Promise to Pay (PTP)",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Conversational customer date commitment workflow enabled",
			Signals:       []string{"PTP parser active", "Customer re-engagement path open"},
		})

		// 4. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Retention Specialist",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      ctx.AttemptsMade >= 2 || ctx.AmountPaise >= 1000000,
			Reason:        "High attempt count or enterprise value threshold qualifies for manual concierge assist",
			Signals:       []string{fmt.Sprintf("Attempt %d/%d", ctx.AttemptsMade, ctx.MaxAttempts)},
		})

	case diagnosis.CauseExpiredCard:
		// 1. UPDATE_PAYMENT_METHOD (Delivery via secure link)
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionUpdatePaymentMethod,
			DisplayName:   "Update Payment Method",
			CandidateType: "RECOVERY",
			Eligible:      canUpdate || true,
			Reason:        "Customer can securely replace invalid instrument via hosted checkout (New Card, UPI, Netbanking)",
			Signals:       []string{"Instrument replacement link ready", "Multi-rail payment gateway supported"},
		})

		// 2. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Support Desk",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      true,
			Reason:        "Manual account manager assist for expired enterprise subscription",
			Signals:       []string{"Permanent instrument decline escalation fallback"},
		})

	case diagnosis.CauseBankDowntime:
		// 1. RETRY_SAME_RAIL_COOLDOWN: Eligible for transient bank outages
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionRetrySameRailCooldown,
			DisplayName:   "Cooldown Auto-Retry",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Transient bank gateway timeout; retry after off-peak cooldown",
			Signals:       []string{fmt.Sprintf("Time since failure: %.1fh", ctx.TimeSinceFailureHours), "Transient bank issue"},
		})

		// 2. SWITCH_TO_AVAILABLE_ALTERNATE_RAIL: Rigorous multi-factor check
		if hasUPI || ctx.OriginalRail != "UPI" {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToAvailableAlternateRail,
				DisplayName:   "Switch to Alternate Rail (Instant UPI)",
				CandidateType: "RECOVERY",
				Eligible:      true,
				Reason:        "Alternate rail supported, verified healthy, customer has eligible UPI instrument, policy permitted",
				Signals:       []string{"Rail: UPI healthy (99.9% uptime)", "Customer has registered VPA", "Transaction amount within UPI limit", "Policy allows rail fallback"},
			})
		} else {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToAvailableAlternateRail,
				DisplayName:   "Switch to Alternate Rail",
				CandidateType: "RECOVERY",
				Eligible:      false,
				Reason:        "Customer has no registered alternate payment instrument and rail is unsupported",
				Signals:       []string{"Single-rail payment profile", "No alternate VPA in vault"},
			})
		}

		// 3. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Human Operations",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      ctx.AmountPaise >= 1000000 || ctx.TimeSinceFailureHours > 4.0,
			Reason:        "Prolonged bank downtime on high-value transaction routes to banking ops",
			Signals:       []string{fmt.Sprintf("Amount: ₹%.2f", float64(ctx.AmountPaise)/100.0)},
		})

	case diagnosis.CauseOtpDropoff:
		// 1. RESUME_CHECKOUT: Primary candidate for drop-off completion
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionResumeCheckout,
			DisplayName:   "Resume Checkout (1-Click Nudge)",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Instant authentication link to resume abandoned checkout session",
			Signals:       []string{"Customer session valid", "Immediate re-engagement viable"},
		})

		// 2. SWITCH_TO_AVAILABLE_ALTERNATE_RAIL: Seamless 1-click bypass without 3DS OTP friction
		if hasUPI || ctx.OriginalRail != "UPI" {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToAvailableAlternateRail,
				DisplayName:   "Switch to Instant UPI",
				CandidateType: "RECOVERY",
				Eligible:      true,
				Reason:        "Offer seamless UPI 1-click bypass without 3DS OTP friction (verified customer VPA)",
				Signals:       []string{"UPI rail verified online", "Customer VPA active", "Zero OTP friction"},
			})
		}

		// 3. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Customer Success",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      ctx.AmountPaise >= 1000000,
			Reason:        "High-value cart abandonment concierge assistance",
			Signals:       []string{fmt.Sprintf("Amount: ₹%.2f", float64(ctx.AmountPaise)/100.0)},
		})

	case diagnosis.CauseMandateRevoked:
		// 1. REAUTHORIZE_MANDATE
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionReauthorizeMandate,
			DisplayName:   "Re-authorize Autopay Mandate",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Send 1-click mandate setup link to re-establish autopay authorization",
			Signals:       []string{"E-mandate gateway supported", "Customer account active"},
		})

		// 2. COLLECT_OUTSTANDING_PAYMENT
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionCollectOutstandingPayment,
			DisplayName:   "Collect Outstanding Invoice",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Collect one-time settlement invoice while mandate authorization is pending",
			Signals:       []string{"Invoice collection workflow active"},
		})

		// 3. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Account Manager",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      ctx.AmountPaise >= 1000000,
			Reason:        "Enterprise mandate cancellation requires dedicated account management",
			Signals:       []string{fmt.Sprintf("Amount: ₹%.2f >= ₹10,000 threshold", float64(ctx.AmountPaise)/100.0)},
		})

	case diagnosis.CauseFraudSuspected:
		// Hard Stop & Human Risk Escalation only
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionStop,
			DisplayName:   "Stop All Automated Recovery",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      true,
			Reason:        "Risk score triggered; hard freeze on automated retries",
			Signals:       []string{"Risk engine anomaly flagged", "Zero automated recovery permitted"},
		})
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Risk Operations",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      true,
			Reason:        "Risk & compliance specialist manual review required",
			Signals:       []string{"Risk review gate enforced"},
		})

	case diagnosis.CauseNetworkDecline:
		// 1. RETRY_SAME_RAIL_COOLDOWN
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionRetrySameRailCooldown,
			DisplayName:   "Exponential Backoff Retry",
			CandidateType: "RECOVERY",
			Eligible:      true,
			Reason:        "Transient network drop; retry with exponential jitter backoff",
			Signals:       []string{"Network TCP reset detected"},
		})
		// 2. SWITCH_TO_AVAILABLE_ALTERNATE_RAIL
		if hasUPI || ctx.OriginalRail != "UPI" {
			evaluations = append(evaluations, CandidateEvaluation{
				Action:        ActionSwitchToAvailableAlternateRail,
				DisplayName:   "Switch to Available Alternate Rail",
				CandidateType: "RECOVERY",
				Eligible:      true,
				Reason:        "Bypass degraded payment network via secondary rail",
				Signals:       []string{"Secondary rail online"},
			})
		}
		// 3. ESCALATE_HUMAN: Safety / Fallback outcome
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate to Operations",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      ctx.AttemptsMade >= 2,
			Reason:        "Persistent network decline across attempts",
			Signals:       []string{"Repeated network failure"},
		})

	default:
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionEscalateHuman,
			DisplayName:   "Escalate Unclassified Failure",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      true,
			Reason:        "Unknown error code requires human investigation",
			Signals:       []string{"Unmapped telemetry"},
		})
		evaluations = append(evaluations, CandidateEvaluation{
			Action:        ActionStop,
			DisplayName:   "Stop",
			CandidateType: "SAFETY_FALLBACK",
			Eligible:      true,
			Reason:        "Safety stop for unclassified failure",
			Signals:       []string{"Unclassified exception"},
		})
	}

	return evaluations
}

// GetEligibleActionNames extracts only the approved eligible action identifiers
func (e *EligibilityEngine) GetEligibleActionNames(ctx RecoveryContext) []string {
	evals := e.EvaluateEligibility(ctx)
	eligible := make([]string, 0)
	for _, ev := range evals {
		if ev.Eligible {
			eligible = append(eligible, ev.Action)
		}
	}
	if len(eligible) == 0 {
		return []string{ActionEscalateHuman, ActionStop}
	}
	return eligible
}

// Global default engine instance
var DefaultEligibilityEngine = NewEligibilityEngine()

// BuildRecoveryContext creates a standard RecoveryContext from case parameters
func BuildRecoveryContext(
	caseID string,
	rootCause string,
	amountPaise int64,
	originalRail string,
	attemptsMade int,
	maxAttempts int,
	paydayProx int,
	histRate float64,
	timeSinceFailH float64,
	hasAltCard bool,
	altCardLabel string,
	altCardPastSuccess int,
	hasUPI bool,
) RecoveryContext {
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	if paydayProx <= 0 {
		paydayProx = 10
	}
	if histRate <= 0 {
		histRate = 0.75
	}
	if timeSinceFailH <= 0 {
		timeSinceFailH = 1.0
	}

	now := time.Now().UTC()

	var availableInsts []PaymentInstrument
	if hasAltCard {
		availableInsts = append(availableInsts, PaymentInstrument{
			ID:          "inst_card_alt_01",
			Type:        "CARD",
			Brand:       "Visa",
			Last4:       "4821",
			IsActive:    true,
			PastTxCount: altCardPastSuccess,
			SuccessRate: 0.85,
			Label:       altCardLabel,
		})
	}
	if hasUPI {
		availableInsts = append(availableInsts, PaymentInstrument{
			ID:        "inst_upi_01",
			Type:      "UPI",
			UPIHandle: "user@okaxis",
			IsActive:  true,
			Label:     "UPI (user@okaxis)",
		})
	}

	return RecoveryContext{
		CaseID:                  caseID,
		RootCause:               rootCause,
		AmountPaise:             amountPaise,
		OriginalRail:            originalRail,
		CurrentInstrument:       PaymentInstrument{Type: originalRail, IsActive: true, Label: fmt.Sprintf("Primary %s", originalRail)},
		AvailableInstruments:    availableInsts,
		AttemptsMade:            attemptsMade,
		MaxAttempts:             maxAttempts,
		TimeSinceFailureHours:   timeSinceFailH,
		PaydayProximityDays:     paydayProx,
		HistoricalSuccessRate:   histRate,
		HasAlternateSavedCard:   hasAltCard,
		AlternateSavedCardLabel: altCardLabel,
		AlternateCardSuccessCnt: altCardPastSuccess,
		HasUPIAvailable:         hasUPI,
		CanUpdatePaymentMethod:  true,
		IsPTPCandidateEligible:  true,
		Hour:                    now.Hour(),
		DayOfWeek:               int(now.Weekday()),
		HighValueThresholdPaise: 1500000, // ₹15,000
	}
}

package intervention

import (
	"github.com/ledger/gateway/internal/diagnosis"
)

// Bounded recovery action constants
const (
	ActionSwitchToSavedCard               = "SWITCH_TO_SAVED_CARD"
	ActionRetryNextPaydayWindow           = "RETRY_NEXT_PAYDAY_WINDOW"
	ActionPromiseToPay                    = "PROMISE_TO_PAY"
	ActionUpdatePaymentMethod             = "UPDATE_PAYMENT_METHOD"
	ActionRetrySameRailCooldown           = "RETRY_SAME_RAIL_COOLDOWN"
	ActionSwitchToAvailableAlternateRail  = "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"
	ActionResumeCheckout                  = "RESUME_CHECKOUT"
	ActionReauthorizeMandate              = "REAUTHORIZE_MANDATE"
	ActionCollectOutstandingPayment       = "COLLECT_OUTSTANDING_PAYMENT"
	ActionEscalateHuman                   = "ESCALATE_HUMAN"
	ActionStop                            = "STOP"
	ActionMarkLost                        = "MARK_LOST_EXHAUSTED"

	// Legacy aliases preserved for backward compatibility in data pipelines
	ActionRetryLater            = ActionRetrySameRailCooldown
	ActionRetrySameRail         = ActionRetrySameRailCooldown
	ActionRetryAuthentication   = ActionResumeCheckout
	ActionReminderNudge         = ActionResumeCheckout
	ActionEscalateToHuman       = ActionEscalateHuman
	ActionCorporateInvoice      = ActionCollectOutstandingPayment
	ActionIncentiveDiscount     = "INCENTIVE_DISCOUNT"
	ActionIncentiveDiscount5Pct = ActionIncentiveDiscount
)

// CandidateActionDefinition describes the bounded operational scope of an action
type CandidateActionDefinition struct {
	Action           string `json:"action"`
	DisplayName      string `json:"display_name"`
	TargetRail       string `json:"target_rail"`
	RequiresBudget   bool   `json:"requires_budget"`
	DefaultCooldownH int    `json:"default_cooldown_hours"`
	Description      string `json:"description"`
}

// AllowedCandidatesByCause defines the standard policy-approved candidate set for fallback
var AllowedCandidatesByCause = map[string][]string{
	diagnosis.CauseBankDowntime: {
		ActionRetrySameRailCooldown,
		ActionSwitchToAvailableAlternateRail,
		ActionEscalateHuman,
	},
	diagnosis.CauseInsufficientFunds: {
		ActionSwitchToSavedCard,
		ActionRetryNextPaydayWindow,
		ActionPromiseToPay,
		ActionEscalateHuman,
	},
	diagnosis.CauseExpiredCard: {
		ActionUpdatePaymentMethod,
		ActionEscalateHuman,
	},
	diagnosis.CauseMandateRevoked: {
		ActionReauthorizeMandate,
		ActionCollectOutstandingPayment,
		ActionEscalateHuman,
	},
	diagnosis.CauseOtpDropoff: {
		ActionResumeCheckout,
		ActionSwitchToAvailableAlternateRail,
		ActionEscalateHuman,
	},
	diagnosis.CauseFraudSuspected: {
		ActionStop,
		ActionEscalateHuman,
	},
	diagnosis.CauseNetworkDecline: {
		ActionRetrySameRailCooldown,
		ActionSwitchToAvailableAlternateRail,
		ActionEscalateHuman,
	},
	diagnosis.CauseUnknown: {
		ActionEscalateHuman,
		ActionStop,
	},
}

// GetAllowedCandidates returns the static fallback candidates for a root cause
func GetAllowedCandidates(cause string) []string {
	if acts, ok := AllowedCandidatesByCause[cause]; ok {
		cp := make([]string, len(acts))
		copy(cp, acts)
		return cp
	}
	return []string{ActionEscalateHuman, ActionStop}
}

// IsActionAllowed checks if a candidate action is legally permitted for a given root cause
func IsActionAllowed(cause, action string) bool {
	// Normalize legacy aliases to canonical names
	switch action {
	case "RETRY_AUTHENTICATION":
		action = ActionResumeCheckout
	case "CORPORATE_INVOICE":
		action = ActionCollectOutstandingPayment
	}

	allowed := GetAllowedCandidates(cause)
	for _, a := range allowed {
		if a == action {
			return true
		}
	}
	return false
}


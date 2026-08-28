package intervention

import (
	"github.com/ledger/gateway/internal/diagnosis"
)

// Bounded recovery action constants
const (
	ActionRetrySameRailCooldown = "RETRY_SAME_RAIL_COOLDOWN"
	ActionSwitchRailUPI         = "SWITCH_RAIL_UPI"
	ActionRetryLater            = "RETRY_LATER"
	ActionRetryNextPaydayWindow = "RETRY_NEXT_PAYDAY_WINDOW"
	ActionIncentiveDiscount     = "INCENTIVE_DISCOUNT"
	ActionCustomerPaymentLink   = "CUSTOMER_PAYMENT_LINK"
	ActionRetryAuthentication   = "RETRY_AUTHENTICATION"
	ActionPromiseToPay          = "PROMISE_TO_PAY"
	ActionCorporateInvoice      = "CORPORATE_INVOICE"
	ActionEscalateHuman         = "ESCALATE_HUMAN"
	ActionStop                  = "STOP"
	ActionMarkLost              = "MARK_LOST_EXHAUSTED"

	// Legacy aliases for backward compatibility
	ActionRetrySameRail         = ActionRetrySameRailCooldown
	ActionReminderNudge         = ActionRetryAuthentication
	ActionEscalateToHuman       = ActionEscalateHuman
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

// AllowedCandidatesByCause defines the strict policy-approved candidate set for every root cause
var AllowedCandidatesByCause = map[string][]string{
	diagnosis.CauseBankDowntime: {
		ActionSwitchRailUPI,
		ActionRetrySameRailCooldown,
	},
	diagnosis.CauseInsufficientFunds: {
		ActionRetryNextPaydayWindow,
		ActionIncentiveDiscount,
		ActionPromiseToPay,
	},
	diagnosis.CauseExpiredCard: {
		ActionSwitchRailUPI,
		ActionEscalateHuman,
	},
	diagnosis.CauseMandateRevoked: {
		ActionSwitchRailUPI,
		ActionCorporateInvoice,
	},
	diagnosis.CauseOtpDropoff: {
		ActionSwitchRailUPI,
		ActionCustomerPaymentLink,
	},
	diagnosis.CauseFraudSuspected: {
		ActionStop,
		ActionEscalateHuman,
	},
	diagnosis.CauseNetworkDecline: {
		ActionSwitchRailUPI,
		ActionRetrySameRailCooldown,
	},
	diagnosis.CauseUnknown: {
		ActionEscalateHuman,
		ActionStop,
	},
}

// GetAllowedCandidates returns the explicit candidate actions permitted for a root cause
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
	allowed := GetAllowedCandidates(cause)
	for _, a := range allowed {
		if a == action {
			return true
		}
	}
	return false
}

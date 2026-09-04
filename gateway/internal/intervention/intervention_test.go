package intervention

import (
	"testing"

	"github.com/ledger/gateway/internal/diagnosis"
)

func TestIntervention_ContextualRankingAndPolicyVetoes(t *testing.T) {
	sel := NewSelector()

	// 1. Contextual shift: Insufficient funds with payday tomorrow (proximity 1) -> ML chooses RETRY_NEXT_PAYDAY_WINDOW
	repFunds := diagnosis.DiagnosticReport{
		CaseID:    "CASE-01",
		RootCause: diagnosis.CauseInsufficientFunds,
	}
	ctxPaydayNear := map[string]interface{}{
		"payday_proximity_days": 1,
	}
	dec1 := sel.SelectIntervention("CASE-01", repFunds, 0, 450000, "CARD", 50000, ctxPaydayNear)
	if dec1.Action != ActionRetryNextPaydayWindow {
		t.Errorf("expected ML to rank %s highest when payday is tomorrow, got %s", ActionRetryNextPaydayWindow, dec1.Action)
	}
	if dec1.PolicyVerdict != "AUTHORIZED" {
		t.Errorf("expected decision to be AUTHORIZED, got %s", dec1.PolicyVerdict)
	}
	if len(dec1.CandidateEvaluations) == 0 {
		t.Errorf("expected candidate evaluations provenance to be populated")
	}

	// 2. Contextual shift: Insufficient funds with Alternate Active Card -> ML chooses SWITCH_TO_SAVED_CARD
	ctxAltCard := map[string]interface{}{
		"payday_proximity_days":        18,
		"has_alternate_saved_card":     true,
		"alternate_saved_card_label":   "Visa •••• 4821",
		"alternate_card_success_count": 4,
		"historical_success_rate":      0.88,
	}
	dec2 := sel.SelectIntervention("CASE-02", repFunds, 0, 420000, "CARD", 50000, ctxAltCard)
	if dec2.Action != ActionSwitchToSavedCard {
		t.Errorf("expected ML to rank %s highest when active backup card exists, got %s", ActionSwitchToSavedCard, dec2.Action)
	}
	if dec2.ActionRationale == nil || len(dec2.ActionRationale.PositiveSignals) == 0 {
		t.Errorf("expected action rationale signals to be populated")
	}

	// 3. Contextual shift: Insufficient funds with payday far away (18d) & NO alternate card -> ML chooses PROMISE_TO_PAY
	ctxPaydayFarNoAlt := map[string]interface{}{
		"payday_proximity_days":    18,
		"has_alternate_saved_card": false,
		"historical_success_rate":  0.65,
	}
	dec3 := sel.SelectIntervention("CASE-03", repFunds, 0, 240000, "CARD", 50000, ctxPaydayFarNoAlt)
	if dec3.Action != ActionPromiseToPay {
		t.Errorf("expected ML to rank %s highest when payday is far and no alternate card, got %s", ActionPromiseToPay, dec3.Action)
	}

	// 4. Expired Card -> Eligibility gates to UPDATE_PAYMENT_METHOD (not blind UPI)
	repExpired := diagnosis.DiagnosticReport{
		CaseID:    "CASE-04",
		RootCause: diagnosis.CauseExpiredCard,
	}
	dec4 := sel.SelectIntervention("CASE-04", repExpired, 0, 360000, "CARD", 50000)
	if dec4.Action != ActionUpdatePaymentMethod {
		t.Errorf("expected expired card to select %s, got %s", ActionUpdatePaymentMethod, dec4.Action)
	}

	// 5. Stopping Rule Veto: Max attempts ceiling (attempts = 3) -> VETOED by Policy Engine
	dec5 := sel.SelectIntervention("CASE-05", repFunds, 3, 450000, "CARD", 50000)
	if dec5.PolicyVerdict != "VETOED" || dec5.Action != ActionMarkLost {
		t.Errorf("expected VETOED with MARK_LOST_EXHAUSTED, got verdict=%s action=%s", dec5.PolicyVerdict, dec5.Action)
	}

	// 6. High-Value Threshold Veto: Amount ₹25,000 >= ₹15,000 ceiling -> VETOED -> ESCALATE_HUMAN
	repMandate := diagnosis.DiagnosticReport{
		CaseID:    "CASE-06",
		RootCause: diagnosis.CauseMandateRevoked,
	}
	dec6 := sel.SelectIntervention("CASE-06", repMandate, 0, 2500000, "NACH_MANDATE", 50000)
	if dec6.PolicyVerdict != "VETOED" || dec6.Action != ActionEscalateHuman {
		t.Errorf("expected high-value transaction to be VETOED and escalated to human, got verdict=%s action=%s", dec6.PolicyVerdict, dec6.Action)
	}

	// 7. Fraud Restriction Veto: Fraud suspected -> VETOED -> ESCALATE_HUMAN (Hard stop)
	repFraud := diagnosis.DiagnosticReport{
		CaseID:    "CASE-07",
		RootCause: diagnosis.CauseFraudSuspected,
	}
	dec7 := sel.SelectIntervention("CASE-07", repFraud, 0, 980000, "CARD", 50000)
	if dec7.PolicyVerdict != "VETOED" || dec7.Action != ActionEscalateHuman {
		t.Errorf("expected fraud to be VETOED and escalated to risk, got verdict=%s action=%s", dec7.PolicyVerdict, dec7.Action)
	}

	// 8. Mandate Limit Exceeded -> Dominant One-Time UPI Switch (mandate preserved)
	repMandateLimit := diagnosis.DiagnosticReport{
		CaseID:    "CASE-08",
		RootCause: diagnosis.CauseMandateLimit,
	}
	dec8 := sel.SelectIntervention("CASE-08", repMandateLimit, 0, 180000, "NACH_MANDATE", 50000)
	if dec8.Action != ActionSwitchToAvailableAlternateRail {
		t.Errorf("expected MANDATE_LIMIT to select %s, got %s", ActionSwitchToAvailableAlternateRail, dec8.Action)
	}
	if dec8.PolicyVerdict != "AUTHORIZED" {
		t.Errorf("expected MANDATE_LIMIT to be AUTHORIZED, got %s", dec8.PolicyVerdict)
	}
	if len(dec8.CandidateEvaluations) < 3 {
		t.Errorf("expected at least 3 candidate evaluations for MANDATE_LIMIT")
	}

	// 9. Overdue B2B Enterprise Invoice -> Dominant PROMISE_TO_PAY recovery
	repOverdue := diagnosis.DiagnosticReport{
		CaseID:    "CASE-09",
		RootCause: diagnosis.CauseOverdueInvoice,
	}
	dec9 := sel.SelectIntervention("CASE-09", repOverdue, 0, 1200000, "BANK_TRANSFER", 50000)
	if dec9.Action != ActionPromiseToPay {
		t.Errorf("expected OVERDUE_INVOICE to select %s, got %s", ActionPromiseToPay, dec9.Action)
	}
	if dec9.PolicyVerdict != "AUTHORIZED" {
		t.Errorf("expected OVERDUE_INVOICE to be AUTHORIZED, got %s", dec9.PolicyVerdict)
	}
}

func TestIntervention_PTPGatingInvariants(t *testing.T) {
	// Rule 3 Invariant: PROMISE_TO_PAY must be allowed for OVERDUE_INVOICE & INSUFFICIENT_FUNDS
	if !IsActionAllowed(diagnosis.CauseOverdueInvoice, ActionPromiseToPay) {
		t.Errorf("PROMISE_TO_PAY MUST be allowed for OVERDUE_INVOICE")
	}
	if !IsActionAllowed(diagnosis.CauseInsufficientFunds, ActionPromiseToPay) {
		t.Errorf("PROMISE_TO_PAY MUST be allowed for INSUFFICIENT_FUNDS")
	}

	// Rule 3 Invariant: PROMISE_TO_PAY must NOT be allowed for MANDATE_REVOKED, MANDATE_LIMIT, or EXPIRED_CARD
	if IsActionAllowed(diagnosis.CauseMandateRevoked, ActionPromiseToPay) {
		t.Errorf("PROMISE_TO_PAY MUST NOT be allowed for MANDATE_REVOKED")
	}
	if IsActionAllowed(diagnosis.CauseMandateLimit, ActionPromiseToPay) {
		t.Errorf("PROMISE_TO_PAY MUST NOT be allowed for MANDATE_LIMIT")
	}
	if IsActionAllowed(diagnosis.CauseExpiredCard, ActionPromiseToPay) {
		t.Errorf("PROMISE_TO_PAY MUST NOT be allowed for EXPIRED_CARD")
	}
}

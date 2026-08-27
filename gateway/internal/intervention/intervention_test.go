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
	if dec1.Action != ActionRetryLater && dec1.Action != ActionRetryNextPaydayWindow {
		t.Errorf("expected ML to rank retry highest when payday is tomorrow, got %s", dec1.Action)
	}
	if dec1.PolicyVerdict != "AUTHORIZED" {
		t.Errorf("expected decision to be AUTHORIZED, got %s", dec1.PolicyVerdict)
	}

	// 2. Contextual shift: Insufficient funds with payday far away (proximity 18) -> ML chooses INCENTIVE_DISCOUNT
	ctxPaydayFar := map[string]interface{}{
		"payday_proximity_days": 18,
	}
	dec2 := sel.SelectIntervention("CASE-02", repFunds, 0, 240000, "CARD", 50000, ctxPaydayFar)
	if dec2.Action != ActionIncentiveDiscount {
		t.Errorf("expected ML to rank %s highest when payday is far, got %s", ActionIncentiveDiscount, dec2.Action)
	}
	if dec2.IncentiveAmountPaise != 12000 { // 5% of ₹2,400 = ₹120 (12,000 paise)
		t.Errorf("expected ₹120 concession, got %d paise", dec2.IncentiveAmountPaise)
	}

	// 3. Stopping Rule Veto: Max attempts ceiling (attempts = 3) -> VETOED by Policy Engine
	dec3 := sel.SelectIntervention("CASE-03", repFunds, 3, 450000, "CARD", 50000)
	if dec3.PolicyVerdict != "VETOED" || dec3.Action != ActionMarkLost {
		t.Errorf("expected VETOED with MARK_LOST_EXHAUSTED, got verdict=%s action=%s", dec3.PolicyVerdict, dec3.Action)
	}

	// 4. High-Value Threshold Veto: Amount ₹12,500 >= ₹10,000 ceiling -> VETOED -> ESCALATE_HUMAN
	repMandate := diagnosis.DiagnosticReport{
		CaseID:    "CASE-04",
		RootCause: diagnosis.CauseMandateRevoked,
	}
	dec4 := sel.SelectIntervention("CASE-04", repMandate, 0, 1250000, "NACH_MANDATE", 50000)
	if dec4.PolicyVerdict != "VETOED" || dec4.Action != ActionEscalateHuman {
		t.Errorf("expected high-value transaction to be VETOED and escalated to human, got verdict=%s action=%s", dec4.PolicyVerdict, dec4.Action)
	}

	// 5. Fraud Restriction Veto: Fraud suspected -> VETOED -> ESCALATE_HUMAN
	repFraud := diagnosis.DiagnosticReport{
		CaseID:    "CASE-05",
		RootCause: diagnosis.CauseFraudSuspected,
	}
	dec5 := sel.SelectIntervention("CASE-05", repFraud, 0, 980000, "CARD", 50000)
	if dec5.PolicyVerdict != "VETOED" || dec5.Action != ActionEscalateHuman {
		t.Errorf("expected fraud to be VETOED and escalated to risk, got verdict=%s action=%s", dec5.PolicyVerdict, dec5.Action)
	}

	// 6. Concession Cap Enforced: 5% of ₹20,000 = ₹1,000, but cap is ₹500 (50,000 paise)
	dec6 := sel.SelectIntervention("CASE-06", repFunds, 0, 800000, "CARD", 50000, ctxPaydayFar)
	if dec6.IncentiveAmountPaise > 50000 {
		t.Errorf("concession exceeded ₹500 cap: got %d paise", dec6.IncentiveAmountPaise)
	}
}

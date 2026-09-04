package diagnosis

import (
	"testing"
)

func TestDiagnosis_AllFailureCauses(t *testing.T) {
	eng := NewEngine()

	// 1. Bank Downtime (504 timeout)
	rep1 := eng.DiagnoseStructured("CASE-01", "gateway_timeout", "bank", "payment_authorization", "Issuer bank timed out", "CARD", 480000)
	if rep1.RootCause != CauseBankDowntime {
		t.Errorf("expected %s, got %s", CauseBankDowntime, rep1.RootCause)
	}

	// 2. Insufficient Funds (soft balance decline)
	rep2 := eng.DiagnoseStructured("CASE-02", "insufficient_funds", "bank", "payment_authorization", "Declined due to low balance", "CARD", 300000)
	if rep2.RootCause != CauseInsufficientFunds {
		t.Errorf("expected %s, got %s", CauseInsufficientFunds, rep2.RootCause)
	}

	// 3. Expired Card (hard decline)
	rep3 := eng.DiagnoseStructured("CASE-03", "card_expired", "bank", "payment_initiation", "Card expiration date passed", "CARD", 150000)
	if rep3.RootCause != CauseExpiredCard {
		t.Errorf("expected %s, got %s", CauseExpiredCard, rep3.RootCause)
	}

	// 4. OTP Drop-off (3DS abandoned)
	rep4 := eng.DiagnoseStructured("CASE-04", "payment_cancelled_by_user", "customer", "payment_authentication", "Customer closed OTP screen", "UPI", 180000)
	if rep4.RootCause != CauseOtpDropoff {
		t.Errorf("expected %s, got %s", CauseOtpDropoff, rep4.RootCause)
	}

	// 5. Mandate Limit Exceeded (single charge breaches per-debit cap)
	rep5a := eng.DiagnoseStructured("CASE-05A", "mandate_max_amount_breached", "bank", "payment_initiation", "Auto-debit exceeds per-transaction limit", "NACH_MANDATE", 1800000)
	if rep5a.RootCause != CauseMandateLimit || rep5a.RecommendedAction != "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL" {
		t.Errorf("expected %s with action SWITCH_TO_AVAILABLE_ALTERNATE_RAIL, got %s / %s", CauseMandateLimit, rep5a.RootCause, rep5a.RecommendedAction)
	}

	// 5b. Mandate Revoked (authorization cancelled)
	rep5b := eng.DiagnoseStructured("CASE-05B", "mandate_cancelled_at_bank", "bank", "payment_authorization", "Autopay revoked at destination bank", "NACH_MANDATE", 1200000)
	if rep5b.RootCause != CauseMandateRevoked || rep5b.RecommendedAction != "REAUTHORIZE_MANDATE" {
		t.Errorf("expected %s with action REAUTHORIZE_MANDATE, got %s / %s", CauseMandateRevoked, rep5b.RootCause, rep5b.RecommendedAction)
	}

	// 6. Fraud Suspected
	rep6 := eng.DiagnoseStructured("CASE-06", "risk_threshold_exceeded", "risk", "payment_initiation", "Velocity anomaly flagged", "CARD", 900000)
	if rep6.RootCause != CauseFraudSuspected || !rep6.RequiresHumanReview {
		t.Errorf("expected %s with human review, got %s (human_review=%v)", CauseFraudSuspected, rep6.RootCause, rep6.RequiresHumanReview)
	}

	// 7. Network Decline
	rep7 := eng.DiagnoseStructured("CASE-07", "network_error", "gateway", "payment_authorization", "TCP connection reset by peer", "CARD", 250000)
	if rep7.RootCause != CauseNetworkDecline {
		t.Errorf("expected %s, got %s", CauseNetworkDecline, rep7.RootCause)
	}

	// 8. Overdue B2B Enterprise Invoice (Net-30)
	rep8 := eng.DiagnoseStructured("CASE-08", "invoice_overdue", "corporate_billing", "invoice_due_date", "B2B enterprise invoice overdue past Net-30 payment terms", "BANK_TRANSFER", 1800000)
	if rep8.RootCause != CauseOverdueInvoice || rep8.RecommendedAction != "PROMISE_TO_PAY" {
		t.Errorf("expected %s with action PROMISE_TO_PAY, got %s / %s", CauseOverdueInvoice, rep8.RootCause, rep8.RecommendedAction)
	}

	// 9. Unknown / Unrecognized -> Must route to human review (No guessing)
	rep9 := eng.DiagnoseStructured("CASE-09", "weird_error_999", "internal", "custom", "Some unmapped bank response", "CARD", 100000)
	if rep9.RootCause != CauseUnknown || !rep9.RequiresHumanReview {
		t.Errorf("expected unknown error requiring human review, got %s (human_review=%v)", rep9.RootCause, rep9.RequiresHumanReview)
	}
}

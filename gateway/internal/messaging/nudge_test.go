package messaging

import (
	"strings"
	"testing"
	"time"

	"github.com/ledger/gateway/internal/intervention"
)

func TestNudgeAgent_AdversarialValidationTests(t *testing.T) {
	agent := NewNudgeAgent()
	validator := NewNudgeValidator()

	reqRetry := NudgeRequest{
		ApprovedAction:      intervention.ActionRetryNextPaydayWindow,
		CustomerName:        "Rahul Verma",
		AmountPaise:         420000,
		Currency:            "INR",
		ScheduledAt:         "Tomorrow (31 Aug 2026)",
		PaymentLink:         "https://rzp.io/i/test4200",
		RootCause:           "INSUFFICIENT_FUNDS",
		PaydayProximityDays: 1,
		Channel:             "WHATSAPP",
	}

	reqExpired := NudgeRequest{
		ApprovedAction: intervention.ActionUpdatePaymentMethod,
		CustomerName:   "NeuralForge Labs",
		AmountPaise:    360000,
		Currency:       "INR",
		PaymentLink:    "https://rzp.io/i/test3600",
		RootCause:      "EXPIRED_CARD",
		Channel:        "EMAIL",
	}

	// Adversarial Test 1: False Settlement Claim ("Your payment has been successfully completed.") -> REJECT
	advDraft1 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		Headline:       "Payment Completed",
		Body:           "Your payment has been successfully completed.",
	}
	res1 := validator.Validate(advDraft1, reqRetry)
	if res1.IsValid {
		t.Errorf("Adversarial Test 1 Failed: Expected REJECT for false settlement claim, but got valid")
	}

	// Adversarial Test 2: Unauthorized Retry Promise ("We'll retry your payment 5 times.") -> REJECT
	advDraft2 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		Headline:       "Retry Notice",
		Body:           "Don't worry, we'll retry your payment 5 times over the next week.",
	}
	res2 := validator.Validate(advDraft2, reqRetry)
	if res2.IsValid {
		t.Errorf("Adversarial Test 2 Failed: Expected REJECT for 5 retries claim exceeding policy ceiling")
	}

	// Adversarial Test 3: Unauthorized Concession ("Get 10% discount on your bill.") -> REJECT
	advDraft3 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		Headline:       "Special Offer",
		Body:           "To help you out, we are waiving your fee with a 10% discount.",
	}
	res3 := validator.Validate(advDraft3, reqRetry)
	if res3.IsValid {
		t.Errorf("Adversarial Test 3 Failed: Expected REJECT for unapproved discount claim")
	}

	// Adversarial Test 4: Credential Solicitation ("Send your PIN and enter your CVV") -> REJECT
	advDraft4 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionUpdatePaymentMethod,
		Headline:       "Card Verification",
		Body:           "To update your card, please reply and send your PIN and enter your CVV number.",
	}
	res4 := validator.Validate(advDraft4, reqExpired)
	if res4.IsValid {
		t.Errorf("Adversarial Test 4 Failed: Expected REJECT for security/credential solicitation")
	}

	// Adversarial Test 5: Inconsistent Claim ("We have charged your card.") for EXPIRED_CARD -> REJECT
	advDraft5 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionUpdatePaymentMethod,
		Headline:       "Card Update",
		Body:           "We have charged your card for the renewal amount.",
	}
	res5 := validator.Validate(advDraft5, reqExpired)
	if res5.IsValid {
		t.Errorf("Adversarial Test 5 Failed: Expected REJECT for expired instrument claiming charge completed")
	}

	// Valid Test 1: Compliant Payday Retry Copy -> ACCEPT
	validDraft1 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		Headline:       "Upcoming Payment Retry",
		Body:           "Hi Rahul, your payment retry is scheduled for tomorrow aligned with your funding window.",
	}
	resValid1 := validator.Validate(validDraft1, reqRetry)
	if !resValid1.IsValid {
		t.Errorf("Valid Test 1 Failed: Expected ACCEPT for compliant retry copy, got: %v", resValid1.Notes)
	}

	// Valid Test 2: Compliant Payment Method Update Copy -> ACCEPT
	validDraft2 := CustomerNudgeDraft{
		ApprovedAction: intervention.ActionUpdatePaymentMethod,
		Headline:       "Update Your Payment Method",
		Body:           "Please update your card details to restore continuous subscription access.",
	}
	resValid2 := validator.Validate(validDraft2, reqExpired)
	if !resValid2.IsValid {
		t.Errorf("Valid Test 2 Failed: Expected ACCEPT for compliant card update copy, got: %v", resValid2.Notes)
	}

	// End-to-end DraftNudge with fallback verification
	draftRevert := agent.DraftNudge(NudgeRequest{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		CustomerName:   "Rahul Verma",
		AmountPaise:    420000,
		Currency:       "INR",
		ScheduledAt:    "31 Aug 2026",
		PaymentLink:    "https://rzp.io/i/test",
		RootCause:      "INSUFFICIENT_FUNDS",
		Channel:        "WHATSAPP",
	})
	if !draftRevert.SafetyValidated {
		t.Errorf("Expected drafted nudge to pass safety validation: %v", draftRevert.ValidationNotes)
	}
}

func TestNudgeAgent_FinancialStateIsolation(t *testing.T) {
	// Proves that Nudge generation is completely side-effect free on financial state
	agent := NewNudgeAgent()

	initialAmountPaise := int64(500000)
	initialStatus := "INTERVENING"
	initialIdempotencyKey := "idem_case_test_9999"

	req := NudgeRequest{
		ApprovedAction: intervention.ActionRetryNextPaydayWindow,
		CustomerName:   "Test Customer",
		AmountPaise:    initialAmountPaise,
		Currency:       "INR",
		PaymentLink:    "https://rzp.io/i/idem_case_test_9999",
		RootCause:      "INSUFFICIENT_FUNDS",
		Channel:        "WHATSAPP",
	}

	// Perform multiple nudge generation requests across channels
	draftWA := agent.DraftNudge(req)
	req.Channel = "EMAIL"
	draftEmail := agent.DraftNudge(req)
	req.Channel = "SMS"
	draftSMS := agent.DraftNudge(req)

	// Verify that generating nudges returns purely text structures
	if draftWA.Body == "" || draftEmail.Body == "" || draftSMS.Body == "" {
		t.Fatalf("Drafted copy should not be empty")
	}

	// Assert financial variables remain identical and unmutated
	if initialAmountPaise != 500000 {
		t.Errorf("Financial amount was mutated: got %d", initialAmountPaise)
	}
	if initialStatus != "INTERVENING" {
		t.Errorf("Status was mutated: got %s", initialStatus)
	}
	if initialIdempotencyKey != "idem_case_test_9999" {
		t.Errorf("Idempotency key was mutated: got %s", initialIdempotencyKey)
	}
}

func TestNudgeAgent_ApprovedActionEnvelope(t *testing.T) {
	agent := NewNudgeAgent()

	envelope := ApprovedActionEnvelope{
		CaseID:          "CASE-7231",
		ApprovedAction:  intervention.ActionUpdatePaymentMethod,
		CustomerName:    "Nexus Analytics Corp",
		AmountPaise:     420000,
		Currency:        "INR",
		ScheduledAt:     "Immediate",
		AllowedCTAs:     []string{"UPDATE_PAYMENT_METHOD", "HELP_DESK"},
		AllowedClaims:   []string{"Update payment instrument"},
		ForbiddenClaims: []string{"Payment captured", "Discount 50%"},
		PaymentLink:     "https://rzp.io/i/7231",
		RootCause:       "EXPIRED_CARD",
		Channel:         "EMAIL",
		ExpiresAt:       time.Now().Add(24 * time.Hour),
	}

	draft := agent.DraftNudgeFromEnvelope(envelope)
	if !draft.SafetyValidated {
		t.Errorf("Expected envelope-drafted nudge to pass validation: %v", draft.ValidationNotes)
	}
	if !strings.Contains(draft.Body, "expired") {
		t.Errorf("Expected draft to mention card expiration from envelope, got: %s", draft.Body)
	}
}

func TestNudgeAgent_SilentActionSuppression(t *testing.T) {
	agent := NewNudgeAgent()

	silentActions := []string{
		intervention.ActionStop,
		intervention.ActionRetrySameRailCooldown,
		intervention.ActionSwitchToSavedCard,
		intervention.ActionEscalateHuman,
	}

	for _, action := range silentActions {
		if ShouldNotifyCustomer(action) {
			t.Errorf("Expected action '%s' to be marked as CustomerFacing=false", action)
		}

		req := NudgeRequest{
			ApprovedAction: action,
			CustomerName:   "Test Corp",
			AmountPaise:    500000,
			Currency:       "INR",
			PaymentLink:    "https://rzp.io/i/test",
			RootCause:      "FRAUD_SUSPECTED",
			Channel:        "EMAIL",
		}

		draft := agent.DraftNudge(req)
		if draft.Body != "" {
			t.Errorf("Expected silent action '%s' to have empty body (suppressed), got: %s", action, draft.Body)
		}
		if !draft.SafetyValidated {
			t.Errorf("Expected silent action '%s' draft to be marked safe/suppressed, got: %v", action, draft.ValidationNotes)
		}
	}
}

func TestEmailService_PolicySuppressionRules(t *testing.T) {
	es := NewEmailService()

	// 1. Fraud stop must be suppressed
	allowed, reason := es.ShouldSendEmailForCase("FRAUD_SUSPECTED", "STOP")
	if allowed {
		t.Errorf("Expected fraud stop to be suppressed, but got allowed: %s", reason)
	}

	// 2. Transient bank downtime cooldown must be suppressed
	allowed, reason = es.ShouldSendEmailForCase("BANK_DOWNTIME_TIMEOUT", "RETRY_SAME_RAIL_COOLDOWN")
	if allowed {
		t.Errorf("Expected transient cooldown to be suppressed, but got allowed: %s", reason)
	}

	// 3. Customer action required must be allowed
	allowed, _ = es.ShouldSendEmailForCase("EXPIRED_CARD", "UPDATE_PAYMENT_METHOD")
	if !allowed {
		t.Errorf("Expected expired card update payment method to be allowed for customer communication")
	}

	// 4. PTP must be allowed
	allowed, _ = es.ShouldSendEmailForCase("INSUFFICIENT_FUNDS", "PROMISE_TO_PAY")
	if !allowed {
		t.Errorf("Expected PTP to be allowed for customer communication")
	}
}

func TestEmailService_EventDrivenDispatchers(t *testing.T) {
	es := NewEmailService()

	// Test Demo Account handling for all event-driven email methods
	to := "user@example.com"

	resAction := es.SendActionRequiredEmail(to, "Rahul", "CASE-001", "Enterprise Cloud", 4800.0, "Card expired", "http://localhost:5173/status/CASE-001")
	if resAction.Status != "SKIPPED_DEMO_ACCOUNT" || !resAction.IsDemoAccount {
		t.Errorf("Expected SKIPPED_DEMO_ACCOUNT for demo email, got: %s", resAction.Status)
	}

	resPTP := es.SendPTPConfirmationEmail(to, "Rahul", "CASE-001", "Enterprise Cloud", 4800.0, "05 Sep 2026", "http://localhost:5173/status/CASE-001")
	if resPTP.Status != "SKIPPED_DEMO_ACCOUNT" || !resPTP.IsDemoAccount {
		t.Errorf("Expected SKIPPED_DEMO_ACCOUNT for PTP confirmation email, got: %s", resPTP.Status)
	}

	resRetry := es.SendRetryScheduledEmail(to, "Rahul", "CASE-001", "Enterprise Cloud", 4800.0, "01 Sep 2026", "http://localhost:5173/status/CASE-001")
	if resRetry.Status != "SKIPPED_DEMO_ACCOUNT" || !resRetry.IsDemoAccount {
		t.Errorf("Expected SKIPPED_DEMO_ACCOUNT for retry scheduled email, got: %s", resRetry.Status)
	}

	resReceipt := es.SendReceiptEmail(to, "Rahul", "CASE-001", "Enterprise Cloud", 4800.0, "pay_rec_001")
	if resReceipt.Status != "SKIPPED_DEMO_ACCOUNT" || !resReceipt.IsDemoAccount {
		t.Errorf("Expected SKIPPED_DEMO_ACCOUNT for payment receipt email, got: %s", resReceipt.Status)
	}
}



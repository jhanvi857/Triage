package messaging

import (
	"strings"

	"github.com/ledger/gateway/internal/intervention"
)

// ValidationResult records the outcome of safety and consistency checks on generated copy
type ValidationResult struct {
	IsValid bool     `json:"is_valid"`
	Notes   []string `json:"notes"`
}

// NudgeValidator enforces hard guardrails on all generative text before customer transmission
type NudgeValidator struct{}

// NewNudgeValidator creates a new output validator
func NewNudgeValidator() *NudgeValidator {
	return &NudgeValidator{}
}

// Validate executes strict safety, claim, and consistency checks on generated draft copy
func (nv *NudgeValidator) Validate(draft CustomerNudgeDraft, req NudgeRequest) ValidationResult {
	notes := make([]string, 0)
	isValid := true

	bodyLower := strings.ToLower(draft.Body)
	headlineLower := strings.ToLower(draft.Headline)
	combined := bodyLower + " " + headlineLower

	// Rule 1: Forbidden False Settlement Claims
	if req.ApprovedAction != "PAYMENT_CAPTURED" {
		if strings.Contains(combined, "payment has been successfully completed") ||
			strings.Contains(combined, "payment is completed") ||
			strings.Contains(combined, "we have charged your card") ||
			strings.Contains(combined, "charged your account successfully") ||
			strings.Contains(combined, "account balance cleared") ||
			strings.Contains(combined, "debt has been forgiven") {
			isValid = false
			notes = append(notes, "REJECTED: False settlement claim in recovery communication")
		}
	}

	// Rule 2: Security & Sensitive Credential Solicitation
	if strings.Contains(combined, "send your pin") ||
		strings.Contains(combined, "enter your cvv") ||
		strings.Contains(combined, "share your otp") ||
		strings.Contains(combined, "password") {
		isValid = false
		notes = append(notes, "REJECTED: Security violation (credential solicitation)")
	}

	// Rule 3: Unauthorized Discretionary Discounts / Concessions
	if req.ApprovedAction != "INCENTIVE_DISCOUNT" {
		if strings.Contains(combined, "% discount") ||
			strings.Contains(combined, "get 10% off") ||
			strings.Contains(combined, "waiving your fee") ||
			strings.Contains(combined, "special discount") {
			isValid = false
			notes = append(notes, "REJECTED: Unauthorized discount/concession promise not approved by policy")
		}
	}

	// Rule 4: Unauthorized Retry Frequency Promises (Exceeding max attempts)
	if strings.Contains(combined, "retry your payment 5 times") ||
		strings.Contains(combined, "retry 10 times") ||
		strings.Contains(combined, "unlimited retries") {
		isValid = false
		notes = append(notes, "REJECTED: Unauthorized retry promise exceeding 3-attempt safety bound")
	}

	// Rule 5: Action Consistency Checks
	switch req.ApprovedAction {
	case intervention.ActionRetryNextPaydayWindow, intervention.ActionRetrySameRailCooldown:
		if strings.Contains(combined, "expired card") {
			isValid = false
			notes = append(notes, "REJECTED: Action inconsistency (retry action cannot claim card is expired)")
		}
	case intervention.ActionUpdatePaymentMethod:
		if strings.Contains(combined, "we will automatically retry") || strings.Contains(combined, "auto-retry scheduled") {
			isValid = false
			notes = append(notes, "REJECTED: Action inconsistency (expired instrument cannot promise automatic retry)")
		}
	}

	// Rule 6: Length and Content Sanity
	if len(strings.TrimSpace(draft.Body)) < 10 {
		isValid = false
		notes = append(notes, "REJECTED: Generated body is empty or truncated")
	}

	if isValid {
		notes = append(notes, "PASSED: All safety, action consistency, and credential checks passed")
	}

	return ValidationResult{
		IsValid: isValid,
		Notes:   notes,
	}
}

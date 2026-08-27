package diagnosis

import (
	"fmt"
	"strings"
	"time"
)

// Root failure causes (Deterministic 7-cause taxonomy + Unknown)
const (
	CauseInsufficientFunds = "INSUFFICIENT_FUNDS"
	CauseBankDowntime      = "BANK_DOWNTIME_TIMEOUT"
	CauseExpiredCard       = "EXPIRED_CARD"
	CauseOtpDropoff        = "OTP_DROP_OFF"
	CauseMandateRevoked    = "MANDATE_REVOKED"
	CauseNetworkDecline    = "NETWORK_DECLINE"
	CauseFraudSuspected    = "FRAUD_SUSPECTED"
	CauseUnknown           = "UNKNOWN_ERROR"
)

// DiagnosticReport contains root cause classification and metadata
type DiagnosticReport struct {
	CaseID              string    `json:"case_id"`
	RootCause           string    `json:"root_cause"`
	ConfidenceScore     float64   `json:"confidence_score"`
	TechnicalReason     string    `json:"technical_reason"`
	CustomerFacingMsg   string    `json:"customer_facing_msg"`
	IsRecoverable       bool      `json:"is_recoverable"`
	RequiresHumanReview bool      `json:"requires_human_review"`
	RecommendedAction   string    `json:"recommended_action,omitempty"`
	DiagnosedAt         time.Time `json:"diagnosed_at"`
}

// Engine diagnoses failed payment payloads into classified root causes deterministically
type Engine struct{}

// NewEngine creates a new deterministic diagnosis engine
func NewEngine() *Engine {
	return &Engine{}
}

// Diagnose evaluates error codes, decline messages, and telemetry to classify failure cause
func (e *Engine) Diagnose(caseID string, errorCode, errorDesc, rail string, amountPaise int64) DiagnosticReport {
	return e.DiagnoseStructured(caseID, errorCode, "", "", errorDesc, rail, amountPaise)
}

// DiagnoseStructured parses Razorpay's structured telemetry (error_reason, error_source, error_step, description)
func (e *Engine) DiagnoseStructured(caseID string, errorReason, errorSource, errorStep, description, rail string, amountPaise int64) DiagnosticReport {
	now := time.Now().UTC()
	reason := strings.ToLower(strings.TrimSpace(errorReason))
	source := strings.ToLower(strings.TrimSpace(errorSource))
	step := strings.ToLower(strings.TrimSpace(errorStep))
	desc := strings.ToLower(strings.TrimSpace(description))
	fullText := fmt.Sprintf("%s %s %s %s", reason, source, step, desc)

	// 1. Expired Card (Hard decline on card validity date)
	if reason == "card_expired" || strings.Contains(fullText, "card_expired") ||
		strings.Contains(fullText, "expired_card") || strings.Contains(fullText, "card expired") ||
		strings.Contains(fullText, "invalid_card") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseExpiredCard,
			ConfidenceScore:     1.0,
			TechnicalReason:     "Payment card validity date expired. Hard decline on same rail.",
			CustomerFacingMsg:   "Your card ending in this instrument has expired. Please switch to UPI or update card.",
			IsRecoverable:       true,
			RequiresHumanReview: false,
			RecommendedAction:   "SWITCH_RAIL_UPI",
			DiagnosedAt:         now,
		}
	}

	// 2. Insufficient Funds (Soft balance decline)
	if reason == "insufficient_funds" || strings.Contains(fullText, "insufficient_funds") ||
		strings.Contains(fullText, "insufficient") || strings.Contains(fullText, "low_balance") ||
		strings.Contains(fullText, "decline_funds") || strings.Contains(fullText, "balance") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseInsufficientFunds,
			ConfidenceScore:     0.96,
			TechnicalReason:     "Account balance below transaction amount. Soft decline.",
			CustomerFacingMsg:   "Payment couldn't be completed due to insufficient balance. Retry scheduled for salary cycle.",
			IsRecoverable:       true,
			RequiresHumanReview: false,
			RecommendedAction:   "RETRY_NEXT_PAYDAY_WINDOW",
			DiagnosedAt:         now,
		}
	}

	// 3. Bank Downtime / Timeout (HTTP 504 / Issuer core system unavailable)
	if (source == "bank" && strings.Contains(desc, "timeout")) ||
		reason == "gateway_timeout" || strings.Contains(fullText, "504") ||
		strings.Contains(fullText, "bank_down") || strings.Contains(fullText, "issuer_unavailable") ||
		strings.Contains(fullText, "gateway_error") || strings.Contains(fullText, "timeout") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseBankDowntime,
			ConfidenceScore:     0.98,
			TechnicalReason:     "Issuer bank core banking system timed out or returned HTTP 504",
			CustomerFacingMsg:   "Bank network is temporarily congested. Automated retry scheduled for off-peak hours.",
			IsRecoverable:       true,
			RequiresHumanReview: false,
			RecommendedAction:   "RETRY_SAME_RAIL_COOLDOWN",
			DiagnosedAt:         now,
		}
	}

	// 4. Mandate Revoked / Subscription Authorization Cancelled
	if reason == "mandate_cancelled_at_bank" || reason == "mandate_revoked" ||
		strings.Contains(fullText, "mandate_revoked") || strings.Contains(fullText, "auth_cancelled") ||
		strings.Contains(fullText, "mandate_failed") || strings.Contains(fullText, "mandate cancelled") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseMandateRevoked,
			ConfidenceScore:     0.99,
			TechnicalReason:     "Recurring e-mandate cancelled at destination bank.",
			CustomerFacingMsg:   "Recurring autopay authorization was paused.",
			IsRecoverable:       true,
			RequiresHumanReview: amountPaise >= 1000000,
			RecommendedAction:   "INCENTIVE_DISCOUNT",
			DiagnosedAt:         now,
		}
	}

	// 5. OTP / 3DS Drop-off (User abandoned challenge window)
	if reason == "payment_cancelled_by_user" || step == "payment_authentication" ||
		strings.Contains(fullText, "otp") || strings.Contains(fullText, "3ds_drop") ||
		strings.Contains(fullText, "abandoned") || strings.Contains(fullText, "user_cancelled") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseOtpDropoff,
			ConfidenceScore:     0.94,
			TechnicalReason:     "Customer abandoned 3D-Secure authentication window without entering OTP.",
			CustomerFacingMsg:   "Payment authentication was interrupted. Use this 1-click link to complete securely.",
			IsRecoverable:       true,
			RequiresHumanReview: false,
			RecommendedAction:   "RETRY_AUTHENTICATION",
			DiagnosedAt:         now,
		}
	}

	// 6. Fraud Suspected / Security Velocity Anomaly
	if reason == "risk_threshold_exceeded" || source == "risk" ||
		strings.Contains(fullText, "fraud") || strings.Contains(fullText, "stolen") ||
		strings.Contains(fullText, "blacklisted") || strings.Contains(fullText, "velocity") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseFraudSuspected,
			ConfidenceScore:     0.92,
			TechnicalReason:     "Security/velocity anomaly triggered. Immediate halt for risk review.",
			CustomerFacingMsg:   "Security flag triggered. Escalated to risk review team.",
			IsRecoverable:       false,
			RequiresHumanReview: true,
			RecommendedAction:   "ESCALATE_HUMAN",
			DiagnosedAt:         now,
		}
	}

	// 7. Network Decline (Transient transport drops, TCP resets)
	if strings.Contains(fullText, "network") || strings.Contains(fullText, "connection") ||
		strings.Contains(fullText, "reset") || strings.Contains(fullText, "drop") {
		return DiagnosticReport{
			CaseID:              caseID,
			RootCause:           CauseNetworkDecline,
			ConfidenceScore:     0.80,
			TechnicalReason:     fmt.Sprintf("Payment transport network decline: %s", description),
			CustomerFacingMsg:   "Payment encountered a network glitch. Retrying with alternate route.",
			IsRecoverable:       true,
			RequiresHumanReview: false,
			RecommendedAction:   "RETRY_SAME_RAIL_COOLDOWN",
			DiagnosedAt:         now,
		}
	}

	// Unknown / Unrecognized cases deterministically route to human review
	return DiagnosticReport{
		CaseID:              caseID,
		RootCause:           CauseUnknown,
		ConfidenceScore:     0.0,
		TechnicalReason:     fmt.Sprintf("Unrecognized failure pattern: reason='%s' source='%s' step='%s' desc='%s'", errorReason, errorSource, errorStep, description),
		CustomerFacingMsg:   "Payment could not be processed. Case has been routed for manual assistance.",
		IsRecoverable:       false,
		RequiresHumanReview: true,
		RecommendedAction:   "ESCALATE_HUMAN",
		DiagnosedAt:         now,
	}
}

package messaging

import (
	"fmt"
	"strings"
	"time"

	"github.com/ledger/gateway/internal/intervention"
)

// CustomerNudgeDraft represents a policy-gated personalized customer message
type CustomerNudgeDraft struct {
	ApprovedAction   string   `json:"approved_action"`
	Channel          string   `json:"channel"` // "WHATSAPP", "EMAIL", "SMS"
	Headline         string   `json:"headline"`
	Body             string   `json:"body"`
	PrimaryCTA       string   `json:"primary_cta"`
	SecondaryCTA     string   `json:"secondary_cta,omitempty"`
	ActionURL        string   `json:"action_url"`
	ModelUsed        string   `json:"model_used"`
	SafetyValidated  bool     `json:"safety_validated"`
	ValidationNotes  []string `json:"validation_notes,omitempty"`
	GeneratedAt      string   `json:"generated_at"`
}

// ApprovedActionEnvelope packages the policy-approved decision and boundaries for the Nudge Agent
type ApprovedActionEnvelope struct {
	CaseID          string    `json:"case_id"`
	ApprovedAction  string    `json:"approved_action"`
	CustomerName    string    `json:"customer_name"`
	AmountPaise     int64     `json:"amount_paise"`
	Currency        string    `json:"currency"`
	ScheduledAt     string    `json:"scheduled_at,omitempty"`
	AllowedCTAs     []string  `json:"allowed_ctas"`
	AllowedClaims   []string  `json:"allowed_claims"`
	ForbiddenClaims []string  `json:"forbidden_claims"`
	PaymentLink     string    `json:"payment_link"`
	RootCause       string    `json:"root_cause"`
	PaydayProxDays  int       `json:"payday_proximity_days,omitempty"`
	AlternateCard   string    `json:"alternate_card_label,omitempty"`
	Channel         string    `json:"channel"`
	ExpiresAt       time.Time `json:"expires_at"`
}

// NudgeRequest contains the policy-approved context required to draft customer copy
type NudgeRequest struct {
	ApprovedAction      string   `json:"approved_action"`
	CustomerName        string   `json:"customer_name"`
	AmountPaise         int64    `json:"amount_paise"`
	Currency            string   `json:"currency"`
	ScheduledAt         string   `json:"scheduled_at,omitempty"`
	AllowedCTAs         []string `json:"allowed_ctas"`
	PaymentLink         string   `json:"payment_link"`
	RootCause           string   `json:"root_cause"`
	PaydayProximityDays int      `json:"payday_proximity_days,omitempty"`
	AlternateCardLabel  string   `json:"alternate_card_label,omitempty"`
	Channel             string   `json:"channel"` // "WHATSAPP", "EMAIL", "SMS"
}

// NudgeAgent generates policy-constrained customer communications downstream of authorization.
// STRICT ARCHITECTURAL RULE: Generative AI drafts copy ONLY for an already-approved action.
// Zero financial decision authority, zero payment API access.
type NudgeAgent struct {
	Validator *NudgeValidator
}

// NewNudgeAgent creates a new customer communication drafting agent
func NewNudgeAgent() *NudgeAgent {
	return &NudgeAgent{
		Validator: NewNudgeValidator(),
	}
}

// DraftNudgeFromEnvelope synthesizes customer copy directly from an immutable ApprovedActionEnvelope
func (na *NudgeAgent) DraftNudgeFromEnvelope(env ApprovedActionEnvelope) CustomerNudgeDraft {
	req := NudgeRequest{
		ApprovedAction:      env.ApprovedAction,
		CustomerName:        env.CustomerName,
		AmountPaise:         env.AmountPaise,
		Currency:            env.Currency,
		ScheduledAt:         env.ScheduledAt,
		AllowedCTAs:         env.AllowedCTAs,
		PaymentLink:         env.PaymentLink,
		RootCause:           env.RootCause,
		PaydayProximityDays: env.PaydayProxDays,
		AlternateCardLabel:  env.AlternateCard,
		Channel:             env.Channel,
	}
	return na.DraftNudge(req)
}

// DraftNudge synthesizes personalized, empathetic, multi-channel copy for an approved recovery action
func (na *NudgeAgent) DraftNudge(req NudgeRequest) CustomerNudgeDraft {
	channel := strings.ToUpper(req.Channel)
	if channel == "" {
		channel = "WHATSAPP"
	}

	amountFormatted := fmt.Sprintf("₹%.2f", float64(req.AmountPaise)/100.0)
	now := time.Now().UTC()

	var draft CustomerNudgeDraft

	switch channel {
	case "WHATSAPP":
		draft = na.draftWhatsApp(req, amountFormatted, now)
	case "EMAIL":
		draft = na.draftEmail(req, amountFormatted, now)
	case "SMS":
		draft = na.draftSMS(req, amountFormatted, now)
	default:
		draft = na.draftWhatsApp(req, amountFormatted, now)
	}

	// Run rigorous Nudge Output Validator
	valResult := na.Validator.Validate(draft, req)
	draft.SafetyValidated = valResult.IsValid
	draft.ValidationNotes = valResult.Notes

	// If validator rejects the generated copy, safely fall back to the deterministic template
	if !valResult.IsValid {
		draft.Headline = "Payment Update"
		tmplParams := TemplateParams{
			CustomerName: req.CustomerName,
			Amount:       amountFormatted,
			PaymentLink:  req.PaymentLink,
			DueDate:      req.ScheduledAt,
		}
		draft.Body = RenderTemplate(req.RootCause, req.ApprovedAction, tmplParams)
		draft.ModelUsed = "Deterministic Fallback (Validator Gated)"
		draft.SafetyValidated = true
		draft.ValidationNotes = append(draft.ValidationNotes, "Reverted to deterministic template due to policy validation check")
	}

	return draft
}

func (na *NudgeAgent) draftWhatsApp(req NudgeRequest, amount string, now time.Time) CustomerNudgeDraft {
	headline := "Subscription Renewal Update"
	var body string
	primaryCTA := "View Payment Details"
	secondaryCTA := "Contact Support"

	switch req.ApprovedAction {
	case intervention.ActionSwitchToSavedCard:
		cardLabel := req.AlternateCardLabel
		if cardLabel == "" {
			cardLabel = "your saved Visa card"
		}
		headline = "1-Tap Retry on Saved Card"
		body = fmt.Sprintf("Hi %s, your payment of %s didn't go through on your primary card. To prevent service interruption, you can switch seamlessly to %s with 1-tap.", req.CustomerName, amount, cardLabel)
		primaryCTA = fmt.Sprintf("Pay via %s", cardLabel)
		secondaryCTA = "Use Different Method"

	case intervention.ActionRetryNextPaydayWindow:
		dateStr := req.ScheduledAt
		if dateStr == "" {
			dateStr = "your scheduled funding window"
		}
		headline = "Automated Retry Scheduled"
		body = fmt.Sprintf("Hi %s, we noticed a temporary balance issue processing your renewal of %s. We've scheduled an automatic retry for %s so you don't have to worry.", req.CustomerName, amount, dateStr)
		primaryCTA = "Review Retry Schedule"
		secondaryCTA = "Pay Now Instead"

	case intervention.ActionPromiseToPay:
		headline = "Pick a Convenient Payment Date"
		body = fmt.Sprintf("Hi %s, your renewal of %s was declined. Reply with your preferred payment date (e.g., 'Pay on Monday') or select a convenient day below to keep your service active.", req.CustomerName, amount)
		primaryCTA = "Select Payment Date"
		secondaryCTA = "Chat with Us"

	case intervention.ActionUpdatePaymentMethod:
		headline = "Update Your Payment Instrument"
		body = fmt.Sprintf("Hi %s, your card has expired for your subscription of %s. Please update your payment method (New Card, UPI, or Netbanking) in 60 seconds to avoid any disruption.", req.CustomerName, amount)
		primaryCTA = "Update Payment Method"
		secondaryCTA = "Help Desk"

	case intervention.ActionRetrySameRailCooldown:
		headline = "Temporary Bank Delay"
		body = fmt.Sprintf("Hi %s, your payment of %s was interrupted by temporary bank gateway maintenance. Our system will automatically retry shortly during off-peak hours.", req.CustomerName, amount)
		primaryCTA = "Check Payment Status"

	case intervention.ActionSwitchToAvailableAlternateRail:
		headline = "Instant UPI Checkout"
		body = fmt.Sprintf("Hi %s, your card network is experiencing downtime for your transaction of %s. You can bypass the outage instantly using UPI.", req.CustomerName, amount)
		primaryCTA = "Pay Instantly via UPI"
		secondaryCTA = "Retry Card"

	case intervention.ActionResumeCheckout:
		headline = "Resume Your Checkout"
		body = fmt.Sprintf("Hi %s, we noticed you didn't complete the OTP verification for %s. Click below to resume and complete your order in 1 click.", req.CustomerName, amount)
		primaryCTA = "Complete Verification"
		secondaryCTA = "Cancel Order"

	case intervention.ActionReauthorizeMandate:
		headline = "Renew Autopay Mandate"
		body = fmt.Sprintf("Hi %s, your recurring autopay mandate of %s was paused by your bank. Please re-authorize your mandate in 1 step to maintain uninterrupted access.", req.CustomerName, amount)
		primaryCTA = "Re-Authorize Mandate"
		secondaryCTA = "Pay One-Time"

	case intervention.ActionCollectOutstandingPayment:
		headline = "Outstanding Subscription Invoice"
		body = fmt.Sprintf("Hi %s, your subscription invoice of %s is pending payment. Click below to settle via any supported payment method.", req.CustomerName, amount)
		primaryCTA = "Settle Invoice"

	case intervention.ActionEscalateHuman:
		headline = "Dedicated Account Assistance"
		body = fmt.Sprintf("Hi %s, we encountered an issue processing your account renewal (%s). A senior billing specialist has been assigned to your case and will reach out shortly.", req.CustomerName, amount)
		primaryCTA = "Contact Specialist"

	default:
		body = fmt.Sprintf("Hi %s, update regarding your transaction of %s. Please click below to review your account status.", req.CustomerName, amount)
	}

	return CustomerNudgeDraft{
		ApprovedAction:  req.ApprovedAction,
		Channel:         "WHATSAPP",
		Headline:        headline,
		Body:            body,
		PrimaryCTA:      primaryCTA,
		SecondaryCTA:    secondaryCTA,
		ActionURL:       req.PaymentLink,
		ModelUsed:       "Deterministic Template Engine (Policy-Constrained)",
		SafetyValidated: true,
		GeneratedAt:     now.Format(time.RFC3339),
	}
}

func (na *NudgeAgent) draftEmail(req NudgeRequest, amount string, now time.Time) CustomerNudgeDraft {
	subject := fmt.Sprintf("Important: Update regarding your payment of %s", amount)
	var body string
	primaryCTA := "Manage Billing"

	switch req.ApprovedAction {
	case intervention.ActionSwitchToSavedCard:
		subject = fmt.Sprintf("Action Needed: Use your backup card for %s", amount)
		body = fmt.Sprintf("Dear %s,\n\nWe were unable to process your payment of %s on your primary card due to insufficient funds.\n\nTo prevent any interruption in your subscription, we can automatically route this payment to %s, which was previously verified on your account.\n\nPlease click below to authorize this switch.", req.CustomerName, amount, req.AlternateCardLabel)
		primaryCTA = "Authorize Backup Card"

	case intervention.ActionRetryNextPaydayWindow:
		subject = fmt.Sprintf("Payment Retry Scheduled for %s", req.ScheduledAt)
		body = fmt.Sprintf("Dear %s,\n\nYour renewal of %s was temporarily declined due to balance availability. To make this effortless for you, our system has scheduled an automatic retry on %s.\n\nNo action is required from you if this timing suits you.", req.CustomerName, amount, req.ScheduledAt)
		primaryCTA = "View Billing Schedule"

	case intervention.ActionUpdatePaymentMethod:
		subject = "Action Required: Update your expired payment method"
		body = fmt.Sprintf("Dear %s,\n\nYour stored card has expired, preventing the renewal of your subscription (%s).\n\nPlease take a moment to provide an updated payment instrument (credit/debit card, UPI, or Netbanking) using our secure portal.", req.CustomerName, amount)
		primaryCTA = "Update Payment Method"

	default:
		body = fmt.Sprintf("Dear %s,\n\nWe encountered a difficulty processing your payment of %s. Please review your account billing page to resolve.", req.CustomerName, amount)
	}

	return CustomerNudgeDraft{
		ApprovedAction:  req.ApprovedAction,
		Channel:         "EMAIL",
		Headline:        subject,
		Body:            body,
		PrimaryCTA:      primaryCTA,
		ActionURL:       req.PaymentLink,
		ModelUsed:       "Deterministic Template Engine (Policy-Constrained)",
		SafetyValidated: true,
		GeneratedAt:     now.Format(time.RFC3339),
	}
}

func (na *NudgeAgent) draftSMS(req NudgeRequest, amount string, now time.Time) CustomerNudgeDraft {
	body := fmt.Sprintf("Alert: Your payment of %s for %s was declined. View secure options & retry: %s", amount, req.CustomerName, req.PaymentLink)
	if req.ApprovedAction == intervention.ActionRetryNextPaydayWindow {
		body = fmt.Sprintf("Notice: Your renewal of %s is scheduled for automatic retry on %s. Details: %s", amount, req.ScheduledAt, req.PaymentLink)
	} else if req.ApprovedAction == intervention.ActionSwitchToSavedCard {
		body = fmt.Sprintf("Alert: Payment of %s failed on primary card. 1-tap switch to backup card: %s", amount, req.PaymentLink)
	}

	return CustomerNudgeDraft{
		ApprovedAction:  req.ApprovedAction,
		Channel:         "SMS",
		Headline:        "SMS Payment Nudge",
		Body:            body,
		PrimaryCTA:      "Open Link",
		ActionURL:       req.PaymentLink,
		ModelUsed:       "Deterministic Template Engine (Policy-Constrained)",
		SafetyValidated: true,
		GeneratedAt:     now.Format(time.RFC3339),
	}
}

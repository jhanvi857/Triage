package messaging

import (
	"crypto/tls"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// EmailDispatchResult represents the outcome of an outbound email attempt
type EmailDispatchResult struct {
	Recipient     string `json:"recipient"`
	Status        string `json:"status"` // "DELIVERED_SMTP", "SKIPPED_DEMO_ACCOUNT", "NOT_CONFIGURED", "FAILED", "DEDUPLICATED"
	Subject       string `json:"subject"`
	Message       string `json:"message"`
	SMTPRelay     string `json:"smtp_relay,omitempty"`
	DispatchedAt  string `json:"dispatched_at"`
	IsDemoAccount bool   `json:"is_demo_account"`
}

// EmailService handles outbound authenticated SMTP email delivery
type EmailService struct {
	SMTPHost  string
	SMTPPort  int
	SMTPUser  string
	SMTPPass  string
	FromEmail string
	dedupMap  map[string]time.Time
	dedupMu   sync.Mutex
}

// NewEmailService initializes email service from environment variables
func NewEmailService() *EmailService {
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	port := 587
	if p, err := strconv.Atoi(portStr); err == nil && p > 0 {
		port = p
	}
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	if from == "" {
		if user != "" {
			from = fmt.Sprintf("CloudCompute Billing <%s>", user)
		} else {
			from = "CloudCompute Recovery <billing@cloudcompute.io>"
		}
	}

	return &EmailService{
		SMTPHost:  host,
		SMTPPort:  port,
		SMTPUser:  user,
		SMTPPass:  pass,
		FromEmail: from,
		dedupMap:  make(map[string]time.Time),
	}
}

// IsDemoDomain detects whether an email address is a synthetic demo / simulation domain
func (es *EmailService) IsDemoDomain(email string) bool {
	clean := strings.ToLower(strings.TrimSpace(email))
	if clean == "" {
		return true
	}
	demoSuffixes := []string{
		"@example.com",
		"@test.com",
		"@acmecloud.io",
		"@nexusanalytics.dev",
		"@neuralforge.ai",
		"@sample.com",
		"@mock.com",
		"@invalid",
		"@localhost",
	}
	for _, suffix := range demoSuffixes {
		if strings.HasSuffix(clean, suffix) {
			return true
		}
	}
	return false
}

// ShouldSendEmailForCase evaluates whether an automated outbound email is policy-authorized
func (es *EmailService) ShouldSendEmailForCase(rootCause, action string) (bool, string) {
	// Rule 1: Fraud/Security Stop - NEVER send automated messaging to bad actors or leak heuristics
	if rootCause == "FRAUD_SUSPECTED" || action == "STOP" {
		return false, "Suppressed by policy: Fraud suspected or risk stop. Outbound communication frozen to protect security heuristics."
	}

	// Rule 2: Transient failure with autonomous retry - Zero customer friction, do not spam
	if action == "RETRY_SAME_RAIL_COOLDOWN" {
		return false, "Suppressed by policy: Transient bank gateway cooldown. Autonomous retry scheduled silently without customer friction."
	}

	// Rule 3: Silent vaulted card retry - do not notify until outcome
	if action == "SWITCH_TO_SAVED_CARD" {
		return false, "Suppressed by policy: Autonomous secondary card retry in progress. Customer notification deferred to outcome."
	}

	return true, "Authorized by policy for event-driven customer communication"
}

// dispatchEmail wraps common gate checks and SMTP transmission
func (es *EmailService) dispatchEmail(to, subject, htmlBody string) EmailDispatchResult {
	now := time.Now().UTC()
	isDemo := es.IsDemoDomain(to)

	deliveryRecipient := to
	// If recipient is a demo domain or empty, but SMTP is configured, route live delivery to the configured SMTP account
	if isDemo {
		if es.SMTPUser != "" && es.SMTPPass != "" {
			deliveryRecipient = es.SMTPUser
			log.Printf("[EMAIL DEMO ROUTING] Routing simulation email for (%s) to configured live SMTP inbox: %s", to, es.SMTPUser)
		} else {
			return EmailDispatchResult{
				Recipient:     to,
				Status:        "SKIPPED_DEMO_ACCOUNT",
				Subject:       subject,
				Message:       fmt.Sprintf("Outbound email skipped for demo simulation account (%s). Log in with your real personal or work email on Storefront to receive live emails.", to),
				DispatchedAt:  now.Format(time.RFC3339),
				IsDemoAccount: true,
			}
		}
	}

	// Deduplication check (15-second debounce window per recipient and subject)
	dedupKey := fmt.Sprintf("%s|%s", strings.ToLower(deliveryRecipient), strings.ToLower(subject))
	es.dedupMu.Lock()
	if lastSent, exists := es.dedupMap[dedupKey]; exists {
		if now.Sub(lastSent) < 15*time.Second {
			es.dedupMu.Unlock()
			log.Printf("[EMAIL DEDUP] Suppressed duplicate email to %s for '%s' (sent %.1fs ago)", deliveryRecipient, subject, now.Sub(lastSent).Seconds())
			return EmailDispatchResult{
				Recipient:     deliveryRecipient,
				Status:        "DEDUPLICATED",
				Subject:       subject,
				Message:       "Duplicate email suppressed by deduplication window",
				DispatchedAt:  now.Format(time.RFC3339),
				IsDemoAccount: isDemo,
			}
		}
	}
	es.dedupMap[dedupKey] = now
	es.dedupMu.Unlock()

	// Gate 2: Check if SMTP credentials are configured in .env
	if es.SMTPHost == "" || es.SMTPUser == "" || es.SMTPPass == "" {
		log.Printf("[EMAIL NOTICE] Outbound SMTP credentials not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in gateway/.env")
		return EmailDispatchResult{
			Recipient:     to,
			Status:        "NOT_CONFIGURED",
			Subject:       subject,
			Message:       "SMTP server not configured in .env. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in gateway/.env to enable live email delivery.",
			DispatchedAt:  now.Format(time.RFC3339),
			IsDemoAccount: false,
		}
	}

	// Deliver via authenticated SMTP relay
	err := es.sendViaSMTP(deliveryRecipient, subject, htmlBody)
	if err != nil {
		log.Printf("[EMAIL ERROR] SMTP delivery failed to %s: %v", deliveryRecipient, err)
		return EmailDispatchResult{
			Recipient:     deliveryRecipient,
			Status:        "FAILED",
			Subject:       subject,
			Message:       fmt.Sprintf("SMTP delivery error: %v", err),
			SMTPRelay:     es.SMTPHost,
			DispatchedAt:  now.Format(time.RFC3339),
			IsDemoAccount: false,
		}
	}

	log.Printf("[EMAIL SUCCESS] Live email delivered to %s via SMTP (%s:%d)", deliveryRecipient, es.SMTPHost, es.SMTPPort)
	return EmailDispatchResult{
		Recipient:     deliveryRecipient,
		Status:        "DELIVERED_SMTP",
		Subject:       subject,
		Message:       fmt.Sprintf("Real recovery email successfully delivered to %s via SMTP server (%s). Check your inbox!", deliveryRecipient, es.SMTPHost),
		SMTPRelay:     fmt.Sprintf("%s:%d", es.SMTPHost, es.SMTPPort),
		DispatchedAt:  now.Format(time.RFC3339),
		IsDemoAccount: isDemo,
	}
}

// SendStatementEmail / SendActionRequiredEmail dispatches a customer recovery statement + secure link
func (es *EmailService) SendStatementEmail(to, customerName, caseID, planName string, amountINR float64, reason, recoveryURL string) EmailDispatchResult {
	return es.SendActionRequiredEmail(to, customerName, caseID, planName, amountINR, reason, recoveryURL)
}

// SendActionRequiredEmail sends a customer-action-required notice with 1-click recovery link
func (es *EmailService) SendActionRequiredEmail(to, customerName, caseID, planName string, amountINR float64, reason, recoveryURL string) EmailDispatchResult {
	subject := fmt.Sprintf("Action Required: Complete Settlement for %s (Invoice #%s)", planName, caseID)
	hasConcession := strings.Contains(strings.ToLower(reason), "concession") || strings.Contains(strings.ToLower(reason), "5%") || strings.Contains(strings.ToLower(reason), "discount")
	if hasConcession {
		subject = fmt.Sprintf("5%% Instant Concession: Pay ₹%.2f for %s (Invoice #%s)", amountINR, planName, caseID)
	}

	concessionBadge := ""
	if hasConcession {
		concessionBadge = ` <span style="font-size: 11px; background: #C6F6D5; color: #22543D; padding: 2px 8px; border-radius: 4px; font-weight: 700; margin-left: 6px;">5% Concession Applied</span>`
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7FAFC; color: #2D3748; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #1A202C; color: #FFFFFF; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #68D391; }
    .content { padding: 28px; }
    .alert-banner { background: #FFF5F5; border-left: 4px solid #E53E3E; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; }
    .alert-title { font-weight: 700; color: #C53030; font-size: 15px; margin-bottom: 4px; }
    .alert-desc { font-size: 13px; color: #742A2A; margin: 0; }
    .invoice-table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-table th, .invoice-table td { padding: 10px 14px; text-align: left; font-size: 14px; border-bottom: 1px solid #EDF2F7; }
    .invoice-table th { color: #718096; font-size: 12px; text-transform: uppercase; }
    .amount-due { font-size: 18px; font-weight: 700; color: #E53E3E; }
    .btn { display: inline-block; background: #2F855A; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 12px 0 24px; }
    .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #EDF2F7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudCompute Inc. &bull; Billing Center</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #A0AEC0;">Triage Autonomous Revenue Recovery</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>%s</strong>,</p>
      
      <div class="alert-banner">
        <div class="alert-title">Payment Renewal Interrupted</div>
        <p class="alert-desc">Your automated renewal for <strong>%s</strong> was interrupted (%s). To avoid service suspension, please complete settlement below.</p>
      </div>

      <table class="invoice-table">
        <tr><th>Invoice Reference</th><td><code>%s</code></td></tr>
        <tr><th>Subscription Item</th><td><strong>%s</strong></td></tr>
        <tr><th>Total Amount Due</th><td><span class="amount-due">₹%.2f</span>%s</td></tr>
        <tr><th>Payment Status</th><td><strong style="color: #E53E3E;">Payment Required</strong></td></tr>
      </table>

      <div style="text-align: center;">
        <a href="%s" class="btn">Complete 1-Click Payment Recovery &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #718096; line-height: 1.5;">
        You can securely settle this invoice via UPI (Google Pay, PhonePe, Paytm), backup card, or schedule an automated retry aligned with your funding window.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 CloudCompute Services Inc. &bull; SHA-256 Ledger Verified &bull; Reference #%s
    </div>
  </div>
</body>
</html>`, customerName, planName, reason, caseID, planName, amountINR, concessionBadge, recoveryURL, caseID)

	return es.dispatchEmail(to, subject, htmlBody)
}

// SendPTPConfirmationEmail sends a Promise-to-Pay confirmation email to the customer
func (es *EmailService) SendPTPConfirmationEmail(to, customerName, caseID, planName string, amountINR float64, promisedDate, recoveryURL string) EmailDispatchResult {
	subject := fmt.Sprintf("Confirmed: Promise-to-Pay Scheduled for %s (Invoice #%s)", promisedDate, caseID)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7FAFC; color: #2D3748; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #1A202C; color: #FFFFFF; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #3182CE; }
    .content { padding: 28px; }
    .info-banner { background: #EBF8FF; border-left: 4px solid #3182CE; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; }
    .info-title { font-weight: 700; color: #2B6CB0; font-size: 15px; margin-bottom: 4px; }
    .info-desc { font-size: 13px; color: #2C5282; margin: 0; }
    .invoice-table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-table th, .invoice-table td { padding: 10px 14px; text-align: left; font-size: 14px; border-bottom: 1px solid #EDF2F7; }
    .invoice-table th { color: #718096; font-size: 12px; text-transform: uppercase; }
    .amount-val { font-size: 18px; font-weight: 700; color: #2B6CB0; }
    .btn { display: inline-block; background: #3182CE; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 12px 0 24px; }
    .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #EDF2F7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudCompute Inc. &bull; Billing Center</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #A0AEC0;">Promise-to-Pay Commitment Confirmation</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>%s</strong>,</p>
      
      <div class="info-banner">
        <div class="info-title">Promise-to-Pay Scheduled</div>
        <p class="info-desc">We have registered your commitment to settle your subscription for <strong>%s</strong> on <strong>%s</strong>. Your compute capacity will remain active until this date.</p>
      </div>

      <table class="invoice-table">
        <tr><th>Invoice Reference</th><td><code>%s</code></td></tr>
        <tr><th>Subscription Item</th><td><strong>%s</strong></td></tr>
        <tr><th>Amount Committed</th><td><span class="amount-val">₹%.2f</span></td></tr>
        <tr><th>Promised Payment Date</th><td><strong style="color: #2B6CB0;">%s</strong></td></tr>
        <tr><th>Current Status</th><td><strong>PTP_COMMITTED (Awaiting Settlement)</strong></td></tr>
      </table>

      <p style="font-size: 13px; color: #718096; line-height: 1.5;">
        We have registered your payment commitment. A notification will be dispatched prior to the scheduled date. No further action is required at this time.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 CloudCompute Services Inc. &bull; SHA-256 Ledger Verified &bull; Reference #%s
    </div>
  </div>
</body>
</html>`, customerName, planName, promisedDate, caseID, planName, amountINR, promisedDate, caseID)

	return es.dispatchEmail(to, subject, htmlBody)
}

// SendRetryScheduledEmail sends a confirmation when an autonomous retry has been scheduled
func (es *EmailService) SendRetryScheduledEmail(to, customerName, caseID, planName string, amountINR float64, scheduledDate, recoveryURL string) EmailDispatchResult {
	subject := fmt.Sprintf("Payment Retry Scheduled for %s (Invoice #%s)", scheduledDate, caseID)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7FAFC; color: #2D3748; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #1A202C; color: #FFFFFF; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #805AD5; }
    .content { padding: 28px; }
    .banner { background: #FAF5FF; border-left: 4px solid #805AD5; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; }
    .banner-title { font-weight: 700; color: #6B46C1; font-size: 15px; margin-bottom: 4px; }
    .banner-desc { font-size: 13px; color: #553C9A; margin: 0; }
    .invoice-table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-table th, .invoice-table td { padding: 10px 14px; text-align: left; font-size: 14px; border-bottom: 1px solid #EDF2F7; }
    .invoice-table th { color: #718096; font-size: 12px; text-transform: uppercase; }
    .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #EDF2F7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudCompute Inc. &bull; Billing Center</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #A0AEC0;">Automated Retry Notification</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>%s</strong>,</p>
      
      <div class="banner">
        <div class="banner-title">Automatic Retry Scheduled</div>
        <p class="banner-desc">An automatic retry for your renewal of <strong>%s</strong> has been scheduled for <strong>%s</strong>.</p>
      </div>

      <table class="invoice-table">
        <tr><th>Invoice Reference</th><td><code>%s</code></td></tr>
        <tr><th>Amount Due</th><td><strong>₹%.2f</strong></td></tr>
        <tr><th>Scheduled Execution</th><td><strong>%s</strong></td></tr>
      </table>

      <p style="font-size: 13px; color: #718096; line-height: 1.5;">
        No action is required from your side. The scheduled retry will execute autonomously on the designated date.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 CloudCompute Services Inc. &bull; SHA-256 Ledger Verified &bull; Reference #%s
    </div>
  </div>
</body>
</html>`, customerName, planName, scheduledDate, caseID, amountINR, scheduledDate, caseID)

	return es.dispatchEmail(to, subject, htmlBody)
}

// SendReceiptEmail dispatches a verified payment receipt email upon confirmed settlement capture
func (es *EmailService) SendReceiptEmail(to, customerName, caseID, planName string, amountINR float64, paymentID string) EmailDispatchResult {
	subject := fmt.Sprintf("Payment Received: ₹%.2f for %s (Receipt #%s)", amountINR, planName, paymentID)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7FAFC; color: #2D3748; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #1A202C; color: #FFFFFF; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #48BB78; }
    .content { padding: 28px; }
    .success-banner { background: #F0FFF4; border-left: 4px solid #38A169; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; }
    .success-title { font-weight: 700; color: #276749; font-size: 15px; margin-bottom: 4px; }
    .success-desc { font-size: 13px; color: #22543D; margin: 0; }
    .invoice-table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-table th, .invoice-table td { padding: 10px 14px; text-align: left; font-size: 14px; border-bottom: 1px solid #EDF2F7; }
    .invoice-table th { color: #718096; font-size: 12px; text-transform: uppercase; }
    .amount-success { font-size: 18px; font-weight: 700; color: #276749; }
    .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #EDF2F7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudCompute Inc. &bull; Billing Center</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #A0AEC0;">Official Settlement Receipt</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>%s</strong>,</p>
      
      <div class="success-banner">
        <div class="success-title">&#10004; Payment Successfully Settled</div>
        <p class="success-desc">Thank you! Your payment of <strong>₹%.2f</strong> for <strong>%s</strong> has been idempotently captured and recorded in the audit ledger.</p>
      </div>

      <table class="invoice-table">
        <tr><th>Transaction Reference</th><td><code>%s</code></td></tr>
        <tr><th>Case / Invoice #</th><td><code>%s</code></td></tr>
        <tr><th>Subscription Item</th><td><strong>%s</strong></td></tr>
        <tr><th>Amount Paid</th><td><span class="amount-success">₹%.2f</span></td></tr>
        <tr><th>Payment Status</th><td><strong style="color: #276749;">SETTLED &bull; RECOVERED</strong></td></tr>
      </table>

      <p style="font-size: 13px; color: #718096; line-height: 1.5;">
        Your service continues without interruption. This receipt is cryptographically verified on the Triage SHA-256 Ledger.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 CloudCompute Services Inc. &bull; SHA-256 Ledger Verified &bull; Transaction #%s
    </div>
  </div>
</body>
</html>`, customerName, amountINR, planName, paymentID, caseID, planName, amountINR, paymentID)

	return es.dispatchEmail(to, subject, htmlBody)
}

// SendEscalationEmail sends an account representative escalation advisory email
func (es *EmailService) SendEscalationEmail(to, customerName, caseID, planName string, amountINR float64, reason, recoveryURL string) EmailDispatchResult {
	subject := fmt.Sprintf("Priority Support Advisory: Subscription Review for %s (Case #%s)", planName, caseID)

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7FAFC; color: #2D3748; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    .header { background: #1A202C; color: #FFFFFF; padding: 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; color: #ED8936; }
    .content { padding: 28px; }
    .warning-banner { background: #FFFAF0; border-left: 4px solid #ED8936; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px; }
    .warning-title { font-weight: 700; color: #C05621; font-size: 15px; margin-bottom: 4px; }
    .warning-desc { font-size: 13px; color: #7B341E; margin: 0; }
    .invoice-table { width: 100%%; border-collapse: collapse; margin-bottom: 24px; }
    .invoice-table th, .invoice-table td { padding: 10px 14px; text-align: left; font-size: 14px; border-bottom: 1px solid #EDF2F7; }
    .invoice-table th { color: #718096; font-size: 12px; text-transform: uppercase; }
    .amount-val { font-size: 18px; font-weight: 700; color: #C05621; }
    .btn { display: inline-block; background: #DD6B20; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 12px 0 24px; }
    .footer { background: #F7FAFC; padding: 20px; text-align: center; font-size: 12px; color: #A0AEC0; border-top: 1px solid #EDF2F7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CloudCompute Inc. &bull; Enterprise Support Desk</h1>
      <p style="margin: 4px 0 0; font-size: 13px; color: #A0AEC0;">VIP High-Value Priority Support</p>
    </div>
    <div class="content">
      <p style="font-size: 15px;">Hello <strong>%s</strong>,</p>
      
      <div class="warning-banner">
        <div class="warning-title">Account Escalated to Senior Account Specialist</div>
        <p class="warning-desc">Your enterprise transaction for <strong>%s</strong> has been routed to our dedicated account desk (%s). Automated collection calls and retries are paused.</p>
      </div>

      <table class="invoice-table">
        <tr><th>Case Reference</th><td><code>%s</code></td></tr>
        <tr><th>Subscription Item</th><td><strong>%s</strong></td></tr>
        <tr><th>Transaction Value</th><td><span class="amount-val">₹%.2f</span></td></tr>
        <tr><th>Escalation Rationale</th><td><strong>%s</strong></td></tr>
        <tr><th>Status</th><td><strong style="color: #DD6B20;">Assigned to Senior Account Specialist</strong></td></tr>
      </table>

      <div style="text-align: center;">
        <a href="%s" class="btn">View Priority Support Portal &rarr;</a>
      </div>

      <p style="font-size: 13px; color: #718096; line-height: 1.5;">
        A dedicated account specialist will assist with wire transfer, customized billing schedule, or purchase order processing.
      </p>
    </div>
    <div class="footer">
      &copy; 2026 CloudCompute Services Inc. &bull; SHA-256 Ledger Verified &bull; Reference #%s
    </div>
  </div>
</body>
</html>`, customerName, planName, reason, caseID, planName, amountINR, reason, recoveryURL, caseID)

	return es.dispatchEmail(to, subject, htmlBody)
}

// sendViaSMTP delivers real email over authenticated SMTP with STARTTLS / TLS
func (es *EmailService) sendViaSMTP(to, subject, htmlContent string) error {
	addr := fmt.Sprintf("%s:%d", es.SMTPHost, es.SMTPPort)
	auth := smtp.PlainAuth("", es.SMTPUser, es.SMTPPass, es.SMTPHost)

	headers := make(map[string]string)
	headers["From"] = es.FromEmail
	headers["To"] = to
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"
	headers["Date"] = time.Now().Format(time.RFC1123Z)

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n" + htmlContent

	// If port 465 (SMTPS) or port 587 (STARTTLS)
	if es.SMTPPort == 465 {
		tlsConfig := &tls.Config{
			ServerName: es.SMTPHost,
		}
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return err
		}
		defer conn.Close()

		c, err := smtp.NewClient(conn, es.SMTPHost)
		if err != nil {
			return err
		}
		defer c.Quit()

		if err = c.Auth(auth); err != nil {
			return err
		}
		if err = c.Mail(es.SMTPUser); err != nil {
			return err
		}
		if err = c.Rcpt(to); err != nil {
			return err
		}
		w, err := c.Data()
		if err != nil {
			return err
		}
		_, err = w.Write([]byte(message))
		if err != nil {
			return err
		}
		return w.Close()
	}

	return smtp.SendMail(addr, auth, es.SMTPUser, []string{to}, []byte(message))
}

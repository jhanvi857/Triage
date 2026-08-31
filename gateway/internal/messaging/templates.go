package messaging

import (
	"strings"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
)

// DeterministicTemplates maps [Cause][Action] to fixed, pre-approved customer messaging templates.
// ZERO LLMs — 100% deterministic parameter substitution.
// Strictly restricted to actions where NotificationPolicy.CustomerFacing == true.
var DeterministicTemplates = map[string]map[string]string{
	diagnosis.CauseExpiredCard: {
		intervention.ActionUpdatePaymentMethod: "Hi {{customer_name}}, your payment of {{amount}} was declined due to card expiration. Update your payment method securely here: {{payment_link}}",
		intervention.ActionSwitchToAvailableAlternateRail: "Hi {{customer_name}}, your payment of {{amount}} could not be completed because your card has expired. You can complete your subscription payment instantly using UPI: {{payment_link}}",
	},
	diagnosis.CauseInsufficientFunds: {
		intervention.ActionRetryNextPaydayWindow: "Hi {{customer_name}}, your payment of {{amount}} was unsuccessful due to temporary balance shortage. We have scheduled an automatic retry for {{due_date}}.",
		intervention.ActionPromiseToPay: "Hi {{customer_name}}, pick a convenient date to complete your payment of {{amount}}: {{payment_link}}",
		intervention.ActionIncentiveDiscount: "Hi {{customer_name}}, your payment of {{amount}} could not be processed. Renew today and get an instant concession applied to your bill: {{payment_link}}",
	},
	diagnosis.CauseBankDowntime: {
		intervention.ActionSwitchToAvailableAlternateRail: "Hi {{customer_name}}, your bank's card gateway is experiencing downtime. You can complete your payment of {{amount}} seamlessly via UPI: {{payment_link}}",
	},
	diagnosis.CauseOtpDropoff: {
		intervention.ActionResumeCheckout: "Hi {{customer_name}}, we noticed you didn't complete the OTP verification for {{amount}}. Click here to resume and finish securely in 1-click: {{payment_link}}",
		intervention.ActionSwitchToAvailableAlternateRail: "Hi {{customer_name}}, skip OTP friction and complete your payment of {{amount}} instantly via UPI: {{payment_link}}",
	},
	diagnosis.CauseMandateRevoked: {
		intervention.ActionReauthorizeMandate: "Hi {{customer_name}}, your recurring autopay mandate for {{amount}} needs re-authorization. Re-link your account in 1 step: {{payment_link}}",
		intervention.ActionCollectOutstandingPayment: "Hi {{customer_name}}, your subscription invoice of {{amount}} is pending payment. Settle securely here: {{payment_link}}",
		intervention.ActionSwitchToAvailableAlternateRail: "Hi {{customer_name}}, your recurring autopay was paused. Complete this one-time payment of {{amount}} via UPI: {{payment_link}}",
		intervention.ActionIncentiveDiscount: "Hi {{customer_name}}, your autopay authorization was paused. Renew today with an exclusive concession: {{payment_link}}",
	},
	diagnosis.CauseNetworkDecline: {
		intervention.ActionSwitchToAvailableAlternateRail: "Hi {{customer_name}}, network congestion affected your card transaction. Complete securely via UPI: {{payment_link}}",
	},
	diagnosis.CauseUnknown: {
		intervention.ActionCollectOutstandingPayment: "Hi {{customer_name}}, invoice for {{amount}} is ready for payment. Settle securely: {{payment_link}}",
	},
}

// TemplateParams holds values to replace placeholders deterministically
type TemplateParams struct {
	CustomerName string
	Amount       string
	PaymentLink  string
	DueDate      string
}

// RenderTemplate performs deterministic placeholder substitution without LLMs
func RenderTemplate(cause, action string, params TemplateParams) string {
	causeMap, ok := DeterministicTemplates[cause]
	if !ok {
		causeMap = DeterministicTemplates[diagnosis.CauseUnknown]
	}

	tmpl, ok := causeMap[action]
	if !ok {
		tmpl = "Hi {{customer_name}}, update regarding your transaction of {{amount}}: please visit {{payment_link}}."
	}

	res := tmpl
	res = strings.ReplaceAll(res, "{{customer_name}}", params.CustomerName)
	res = strings.ReplaceAll(res, "{{amount}}", params.Amount)
	res = strings.ReplaceAll(res, "{{payment_link}}", params.PaymentLink)
	res = strings.ReplaceAll(res, "{{due_date}}", params.DueDate)

	return res
}

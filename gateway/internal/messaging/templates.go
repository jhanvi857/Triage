package messaging

import (
	"strings"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
)

// DeterministicTemplates maps [Cause][Action] to fixed, pre-approved customer messaging templates
// ZERO LLMs — 100% deterministic parameter substitution
var DeterministicTemplates = map[string]map[string]string{
	diagnosis.CauseExpiredCard: {
		intervention.ActionSwitchRailUPI: "Hi {{customer_name}}, your payment of {{amount}} could not be completed because your card has expired. You can complete your subscription payment instantly using UPI: {{payment_link}}",
		intervention.ActionCustomerPaymentLink: "Hi {{customer_name}}, your payment of {{amount}} was declined due to card expiration. Update your payment method securely here: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, we noticed an issue renewing your subscription ({{amount}}). Our customer care team will be in touch shortly to assist you.",
	},
	diagnosis.CauseInsufficientFunds: {
		intervention.ActionRetryNextPaydayWindow: "Hi {{customer_name}}, your payment of {{amount}} was unsuccessful due to temporary balance shortage. We have scheduled an automatic retry for {{due_date}}.",
		intervention.ActionRetryLater: "Hi {{customer_name}}, your payment of {{amount}} did not go through. We will automatically retry in 24 hours.",
		intervention.ActionIncentiveDiscount: "Hi {{customer_name}}, your payment of {{amount}} could not be processed. Renew today and get an instant concession applied to your bill: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, we noticed a payment failure for your account ({{amount}}). An account specialist will reach out to ensure uninterrupted service.",
	},
	diagnosis.CauseBankDowntime: {
		intervention.ActionRetrySameRailCooldown: "Hi {{customer_name}}, your payment of {{amount}} was interrupted due to a temporary bank gateway timeout. We will automatically retry your payment during off-peak hours.",
		intervention.ActionSwitchRailUPI: "Hi {{customer_name}}, your bank's card gateway is experiencing downtime. You can complete your payment of {{amount}} seamlessly via UPI: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, we encountered bank downtime processing {{amount}}. Our support desk is monitoring the situation and will update you.",
	},
	diagnosis.CauseOtpDropoff: {
		intervention.ActionRetryAuthentication: "Hi {{customer_name}}, we noticed you didn't complete the OTP verification for {{amount}}. Click here to resume and finish securely in 1-click: {{payment_link}}",
		intervention.ActionCustomerPaymentLink: "Hi {{customer_name}}, your transaction of {{amount}} is pending completion. Use this secure checkout link to finish: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, your payment authentication was interrupted. Contact support or click {{payment_link}} to complete.",
	},
	diagnosis.CauseMandateRevoked: {
		intervention.ActionIncentiveDiscount: "Hi {{customer_name}}, your autopay authorization was paused. Renew today to keep your service active with an exclusive discount: {{payment_link}}",
		intervention.ActionSwitchRailUPI: "Hi {{customer_name}}, your recurring autopay needs to be re-authorized for {{amount}}. Refresh your UPI autopay mandate here: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, your recurring subscription authorization requires attention. A senior account manager will reach out to assist you.",
	},
	diagnosis.CauseNetworkDecline: {
		intervention.ActionRetrySameRailCooldown: "Hi {{customer_name}}, a transient network issue interrupted your payment of {{amount}}. We are automatically retrying shortly.",
		intervention.ActionSwitchRailUPI: "Hi {{customer_name}}, network congestion affected your card transaction. Complete securely via UPI: {{payment_link}}",
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, our team is assisting with your pending transaction of {{amount}}.",
	},
	diagnosis.CauseFraudSuspected: {
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, a security flag was raised on transaction {{amount}}. Our risk verification team will review and contact you shortly.",
		intervention.ActionStop: "Hi {{customer_name}}, transaction processing has been suspended for security verification.",
	},
	diagnosis.CauseUnknown: {
		intervention.ActionEscalateHuman: "Hi {{customer_name}}, we encountered an unexpected issue processing your payment of {{amount}}. A support manager has been assigned to your case.",
		intervention.ActionStop: "Hi {{customer_name}}, payment processing was stopped. Please visit {{payment_link}} for assistance.",
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

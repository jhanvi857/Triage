package recovery

import (
	"math"
	"sort"
	"time"
)

// Source type constants for multi-surface revenue risk
const (
	SourceFailedPayment      = "FAILED_PAYMENT"
	SourceAbandonedCheckout  = "ABANDONED_CHECKOUT"
	SourceFailedSubscription = "FAILED_SUBSCRIPTION"
	SourceOverdueInvoice     = "OVERDUE_INVOICE"
	SourceMandateFailure     = "MANDATE_FAILURE"
	SourcePromiseToPay       = "PROMISE_TO_PAY"
)

// PriorityExplanation makes priority scoring transparent and explainable
type PriorityExplanation struct {
	GrossExpectedRecoveryPaise int64   `json:"gross_expected_recovery_paise"`
	GrossExpectedRecoveryINR   float64 `json:"gross_expected_recovery_inr"`
	NetExpectedRecoveryPaise   int64   `json:"net_expected_recovery_paise"`
	NetExpectedRecoveryINR     float64 `json:"net_expected_recovery_inr"`
	RecoveryProbability        float64 `json:"recovery_probability"`
	TimeSensitivity            float64 `json:"time_sensitivity"`
	TimeSensitivityReason      string  `json:"time_sensitivity_reason"`
	CustomerValueFactor        float64 `json:"customer_value_factor"`
	InterventionCostPaise      int64   `json:"intervention_cost_paise"`
	RiskPenaltyPaise           int64   `json:"risk_penalty_paise"`
	FinalScorePaise            int64   `json:"final_score_paise"`
	FinalScoreINR              float64 `json:"final_score_inr"`
}

// PrioritizedOpportunity is a case ranked by expected recovery value
type PrioritizedOpportunity struct {
	CaseID        string              `json:"case_id"`
	CustomerID    string              `json:"customer_id"`
	CustomerName  string              `json:"customer_name"`
	SourceType    string              `json:"source_type"`
	AmountPaise   int64               `json:"amount_paise"`
	AmountINR     float64             `json:"amount_inr"`
	Status        string              `json:"status"`
	Action        string              `json:"action,omitempty"`
	PriorityScore float64             `json:"priority_score"`
	PriorityRank  int                 `json:"priority_rank"`
	Explanation   PriorityExplanation `json:"explanation"`
}

// PortfolioSummary contains the prioritized queue and aggregate metrics
type PortfolioSummary struct {
	TotalOpportunities      int                      `json:"total_opportunities"`
	TotalRevenueAtRiskPaise int64                    `json:"total_revenue_at_risk_paise"`
	TotalRevenueAtRiskINR   float64                  `json:"total_revenue_at_risk_inr"`
	TotalExpectedRecovPaise int64                    `json:"total_expected_recovery_paise"`
	TotalExpectedRecovINR   float64                  `json:"total_expected_recovery_inr"`
	Queue                   []PrioritizedOpportunity `json:"queue"`
}

// PrioritizePortfolio scores and ranks all active recovery opportunities
func PrioritizePortfolio(cases []*Case) PortfolioSummary {
	var queue []PrioritizedOpportunity
	var totalRisk, totalExpected int64

	for _, c := range cases {
		// Only prioritize non-terminal cases
		if c.Status == StatusRecovered || c.Status == StatusLost {
			continue
		}

		explanation := ComputePriority(c)
		totalRisk += c.AmountPaise
		totalExpected += explanation.NetExpectedRecoveryPaise

		action := ""
		if c.Intervention != nil {
			action = c.Intervention.Action
		}

		queue = append(queue, PrioritizedOpportunity{
			CaseID:        c.ID,
			CustomerID:    c.CustomerID,
			CustomerName:  c.CustomerName,
			SourceType:    c.SourceType,
			AmountPaise:   c.AmountPaise,
			AmountINR:     float64(c.AmountPaise) / 100.0,
			Status:        c.Status,
			Action:        action,
			PriorityScore: explanation.FinalScoreINR,
			Explanation:   explanation,
		})
	}

	// Sort descending by priority score
	sort.Slice(queue, func(i, j int) bool {
		return queue[i].PriorityScore > queue[j].PriorityScore
	})

	// Assign ranks
	for i := range queue {
		queue[i].PriorityRank = i + 1
	}

	return PortfolioSummary{
		TotalOpportunities:      len(queue),
		TotalRevenueAtRiskPaise: totalRisk,
		TotalRevenueAtRiskINR:   float64(totalRisk) / 100.0,
		TotalExpectedRecovPaise: totalExpected,
		TotalExpectedRecovINR:   float64(totalExpected) / 100.0,
		Queue:                   queue,
	}
}

// ComputePriority computes the full explainable priority breakdown for a case
func ComputePriority(c *Case) PriorityExplanation {
	// 1. Recovery probability (from ML or default)
	recoveryProb := 0.50
	if c.Intervention != nil && c.Intervention.MLProbability > 0 {
		recoveryProb = c.Intervention.MLProbability
	} else if c.HistoricalSuccessRate > 0 {
		recoveryProb = c.HistoricalSuccessRate * 0.7 // Discount historical to be conservative
	}

	// 2. Gross Expected Recovery = P(recovery) × (Amount - Concession)
	// (Concession is realized conditional on successful recovery)
	effectiveAmountPaise := c.AmountPaise - c.IncentiveDiscountPaise
	if effectiveAmountPaise < 0 {
		effectiveAmountPaise = 0
	}
	grossExpectedPaise := int64(recoveryProb * float64(effectiveAmountPaise))

	// 3. Operational intervention cost (incurred up-front)
	interventionCostPaise := int64(0)
	if c.Intervention != nil {
		switch c.Intervention.Action {
		case "ESCALATE_HUMAN":
			interventionCostPaise = 5000 // ₹50 human agent cost
		case "PROMISE_TO_PAY":
			interventionCostPaise = 2000 // ₹20 PTP management cost
		default:
			interventionCostPaise = 500 // ₹5 automated cost
		}
	}

	// Net Expected Recovery (Action-level) = GrossEV - InterventionCost
	netExpectedPaise := grossExpectedPaise - interventionCostPaise
	if netExpectedPaise < 0 {
		netExpectedPaise = 0
	}

	// 4. Time Sensitivity - deterministic bounded function per source type
	timeSensitivity, tsReason := computeTimeSensitivity(c)

	// 5. Customer Value Factor - based on observed historical profile
	// Cold-start (HistoricalAttempts == 0 or unobserved): 1.0 (neutral multiplier)
	// Observed history (HistoricalAttempts > 0): 0.5 + HistoricalSuccessRate
	//   - 0% success (e.g. 0/10) -> 0.5 (maximum penalty, not 1.0 default)
	//   - 50% success -> 1.0 (neutral)
	//   - 100% success -> 1.5 (maximum boost)
	cvf := 1.0
	if c.HistoricalAttempts > 0 {
		cvf = 0.5 + c.HistoricalSuccessRate
		if cvf < 0.5 {
			cvf = 0.5
		} else if cvf > 1.5 {
			cvf = 1.5
		}
	} else if c.HistoricalSuccessRate > 0 {
		// Backwards-compatible fallback when rate was set without explicit attempt count
		cvf = 0.5 + c.HistoricalSuccessRate
		if cvf > 1.5 {
			cvf = 1.5
		}
	}

	// 6. Risk penalty (fraud signals, high attempt count)
	riskPenaltyPaise := int64(0)
	if c.AttemptsMade >= 2 {
		riskPenaltyPaise += 1000 // ₹10 per case nearing exhaustion
	}
	if c.Diagnosis != nil && c.Diagnosis.RootCause == "FRAUD_SUSPECTED" {
		riskPenaltyPaise += c.AmountPaise // Full penalty for fraud - effectively zeros score
	}

	// Portfolio Priority Score = NetExpectedRecovery × TimeSensitivity × CVF - RiskPenalty
	score := float64(netExpectedPaise)*timeSensitivity*cvf - float64(riskPenaltyPaise)
	if score < 0 {
		score = 0
	}

	return PriorityExplanation{
		GrossExpectedRecoveryPaise: grossExpectedPaise,
		GrossExpectedRecoveryINR:   float64(grossExpectedPaise) / 100.0,
		NetExpectedRecoveryPaise:   netExpectedPaise,
		NetExpectedRecoveryINR:     float64(netExpectedPaise) / 100.0,
		RecoveryProbability:        math.Round(recoveryProb*10000) / 10000,
		TimeSensitivity:            math.Round(timeSensitivity*1000) / 1000,
		TimeSensitivityReason:      tsReason,
		CustomerValueFactor:        math.Round(cvf*100) / 100,
		InterventionCostPaise:      interventionCostPaise,
		RiskPenaltyPaise:           riskPenaltyPaise,
		FinalScorePaise:            int64(score),
		FinalScoreINR:              math.Round(score) / 100.0,
	}
}

// computeTimeSensitivity returns a bounded [0.1, 2.0] multiplier with explanation
func computeTimeSensitivity(c *Case) (float64, string) {
	now := time.Now().UTC()
	minutesSinceCreation := now.Sub(c.CreatedAt).Minutes()

	switch c.SourceType {
	case SourceAbandonedCheckout:
		// Highest immediately after abandonment, decays over hours
		if minutesSinceCreation <= 30 {
			return 2.0, "Abandoned checkout: critical window (< 30 min)"
		} else if minutesSinceCreation <= 120 {
			return 1.5, "Abandoned checkout: high urgency (< 2 hours)"
		}
		return 0.8, "Abandoned checkout: decaying urgency (> 2 hours)"

	case SourceFailedSubscription:
		// Higher near billing deadline
		if c.PaydayProximityDays <= 2 {
			return 1.8, "Subscription: near billing deadline (≤ 2 days)"
		} else if c.PaydayProximityDays <= 7 {
			return 1.2, "Subscription: approaching deadline (≤ 7 days)"
		}
		return 0.7, "Subscription: far from deadline"

	case SourceOverdueInvoice:
		// Increases with invoice age
		ageDays := minutesSinceCreation / 1440 // Convert to days
		if ageDays >= 30 {
			return 1.8, "Invoice: severely overdue (≥ 30 days)"
		} else if ageDays >= 14 {
			return 1.4, "Invoice: overdue (≥ 14 days)"
		} else if ageDays >= 7 {
			return 1.1, "Invoice: moderately overdue (≥ 7 days)"
		}
		return 0.8, "Invoice: recently issued"

	case SourcePromiseToPay:
		// Highest around promised date
		return 1.5, "Promise-to-pay: active commitment requires timely follow-up"

	case SourceMandateFailure:
		return 1.3, "Mandate failure: recurring revenue at risk"

	default: // FAILED_PAYMENT
		if minutesSinceCreation <= 60 {
			return 1.4, "Payment failure: fresh (< 1 hour)"
		} else if minutesSinceCreation <= 240 {
			return 1.1, "Payment failure: recent (< 4 hours)"
		}
		return 0.9, "Payment failure: aging"
	}
}

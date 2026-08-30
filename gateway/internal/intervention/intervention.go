package intervention

import (
	"fmt"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/mlclient"
)

// PolicyRuleEvaluation records the check result for a single safety constraint
type PolicyRuleEvaluation struct {
	RuleName string `json:"rule_name"`
	Passed   bool   `json:"passed"`
	Reason   string `json:"reason"`
}

// Decision contains the selected intervention, ML rankings, and policy engine veto checks
type Decision struct {
	CaseID               string                 `json:"case_id"`
	Action               string                 `json:"action"`
	Reasoning            string                 `json:"reasoning"`
	TargetRail           string                 `json:"target_rail,omitempty"`
	CooldownDuration     time.Duration          `json:"cooldown_duration"`
	NextExecutionAt      time.Time              `json:"next_execution_at"`
	IncentiveAmountPaise int64                  `json:"incentive_amount_paise,omitempty"`
	IncentivePercent     float64                `json:"incentive_percent,omitempty"`
	IsStoppingRuleHit    bool                   `json:"is_stopping_rule_hit"`
	StoppingReason       string                 `json:"stopping_reason,omitempty"`
	PolicyVerdict        string                 `json:"policy_verdict"` // "AUTHORIZED" or "VETOED"
	PolicyRules          []PolicyRuleEvaluation `json:"policy_rules"`
	MLRankings           []mlclient.RankedCandidate `json:"ml_rankings,omitempty"`
	MLRecommendation     string                 `json:"ml_recommendation,omitempty"`
	MLProbability        float64                `json:"ml_probability,omitempty"`
	MLExpectedValuePaise int64                  `json:"ml_expected_value_paise,omitempty"`
	ShadowBandit         *mlclient.ShadowBanditReport `json:"shadow_bandit,omitempty"`
	MaxAttempts          int                    `json:"max_attempts"`
	CurrentAttempt       int                    `json:"current_attempt"`
}

// Selector evaluates diagnosis, ML ranking, and case state to pick and authorize bounded interventions
type Selector struct {
	MaxAttemptsDefault   int
	MaxIncentiveCapPaise int64 // ₹500 (50,000 paise)
	HighValueThreshold   int64 // ₹10,000 (1,000,000 paise)
	MLClient             *mlclient.Client
}

// NewSelector creates a new intervention selector with ML client
func NewSelector() *Selector {
	return &Selector{
		MaxAttemptsDefault:   3,
		MaxIncentiveCapPaise: 50000,   // ₹500 max concession per case
		HighValueThreshold:   1000000, // ₹10,000
		MLClient:             mlclient.NewClient("http://localhost:8000"),
	}
}

// SetMLClient overrides default ML client (e.g. for testing)
func (s *Selector) SetMLClient(client *mlclient.Client) {
	s.MLClient = client
}

// SelectIntervention ranks allowed candidate actions via ML and enforces deterministic policy authorization
func (s *Selector) SelectIntervention(
	caseID string,
	report diagnosis.DiagnosticReport,
	currentAttempts int,
	amountPaise int64,
	originalRail string,
	availableBudgetPaise int64,
	extraContext ...map[string]interface{},
) Decision {
	now := time.Now().UTC()
	nextAttempt := currentAttempts + 1

	// 1. Get explicit bounded candidates for this cause
	allowedCandidates := GetAllowedCandidates(report.RootCause)

	// Extract contextual features
	paydayProx := 10
	timeSinceFailH := 1.0
	hour := now.Hour()
	dayOfWeek := int(now.Weekday())
	histRate := 0.72

	if len(extraContext) > 0 && extraContext[0] != nil {
		ctx := extraContext[0]
		if p, ok := ctx["payday_proximity_days"].(int); ok {
			paydayProx = p
		}
		if t, ok := ctx["time_since_failure_hours"].(float64); ok {
			timeSinceFailH = t
		}
		if h, ok := ctx["hour"].(int); ok {
			hour = h
		}
		if d, ok := ctx["day_of_week"].(int); ok {
			dayOfWeek = d
		}
		if r, ok := ctx["historical_success_rate"].(float64); ok {
			histRate = r
		}
	}

	features := mlclient.CaseFeatures{
		CaseID:                caseID,
		Cause:                 report.RootCause,
		AmountPaise:           amountPaise,
		AttemptNumber:         nextAttempt,
		TimeSinceFailureHours: timeSinceFailH,
		OriginalRail:          originalRail,
		DayOfWeek:             dayOfWeek,
		Hour:                  hour,
		PaydayProximityDays:   paydayProx,
		HistoricalSuccessRate: histRate,
		PreviousSuccessCount:  6,
		DaysSinceLastPayment:  25,
		CandidateActions:      allowedCandidates,
	}

	// 2. Query ML Service to rank candidate actions by P(recover|x, a) * amount
	rankResp := s.MLClient.RankCandidates(features)
	mlRankings := rankResp.RankedCandidates

	var topCandidate mlclient.RankedCandidate
	if len(mlRankings) > 0 {
		topCandidate = mlRankings[0]
	} else {
		topCandidate = mlclient.RankedCandidate{
			Action:             allowedCandidates[0],
			Probability:        0.50,
			ExpectedValuePaise: amountPaise / 2,
		}
	}

	// 3. DETERMINISTIC POLICY ENGINE / FINAL VETO
	policyRules := make([]PolicyRuleEvaluation, 0)
	isVetoed := false
	var vetoAction string
	var vetoReason string

	// Rule 1: Permitted Candidate Action Check
	actionPermitted := IsActionAllowed(report.RootCause, topCandidate.Action)
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "CANDIDATE_LEGITIMACY",
		Passed:   actionPermitted,
		Reason:   fmt.Sprintf("Action '%s' is in pre-approved candidate set for '%s'", topCandidate.Action, report.RootCause),
	})
	if !actionPermitted {
		isVetoed = true
		vetoAction = ActionEscalateHuman
		vetoReason = fmt.Sprintf("ML proposed non-approved action '%s' for cause '%s'", topCandidate.Action, report.RootCause)
	}

	// Rule 2: Max Attempts Ceiling (Stopping Rule)
	maxAttemptsPassed := currentAttempts < s.MaxAttemptsDefault
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "MAX_ATTEMPTS_LIMIT",
		Passed:   maxAttemptsPassed,
		Reason:   fmt.Sprintf("Current attempts: %d / %d max allowed", currentAttempts, s.MaxAttemptsDefault),
	})
	if !maxAttemptsPassed {
		isVetoed = true
		vetoAction = ActionMarkLost
		vetoReason = fmt.Sprintf("Stopping rule triggered: reached max retry attempts (%d/%d). Ceasing automated dunning.", currentAttempts, s.MaxAttemptsDefault)
	}

	// Rule 3: Fraud Restrictions
	fraudPassed := report.RootCause != diagnosis.CauseFraudSuspected
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "FRAUD_SECURITY_GATE",
		Passed:   fraudPassed,
		Reason:   "Security anomaly and velocity check",
	})
	if !fraudPassed {
		isVetoed = true
		vetoAction = ActionEscalateHuman
		vetoReason = "Security flag triggered: transaction flagged as suspected fraud or velocity anomaly. Directing to risk officer."
	}

	// Rule 4: High-Value Escalation Threshold (₹10,000)
	highValuePassed := amountPaise < s.HighValueThreshold
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "HIGH_VALUE_THRESHOLD",
		Passed:   highValuePassed,
		Reason:   fmt.Sprintf("Transaction amount ₹%.2f vs ₹%.2f escalation ceiling", float64(amountPaise)/100.0, float64(s.HighValueThreshold)/100.0),
	})
	if !highValuePassed {
		isVetoed = true
		vetoAction = ActionEscalateHuman
		vetoReason = fmt.Sprintf("High-value transaction (₹%.2f >= ₹10,000 threshold). Automated recovery vetoed; assigned to Senior Retention Desk.", float64(amountPaise)/100.0)
	}

	// Rule 5: Concession Cap and Token Budget Check
	var concessionPaise int64 = 0
	var concessionPercent float64 = 0.0

	if topCandidate.Action == ActionIncentiveDiscount {
		concessionPaise = int64(float64(amountPaise) * 0.05)
		if concessionPaise > s.MaxIncentiveCapPaise {
			concessionPaise = s.MaxIncentiveCapPaise
		}
		concessionPercent = 5.0

		budgetPassed := concessionPaise <= availableBudgetPaise
		policyRules = append(policyRules, PolicyRuleEvaluation{
			RuleName: "CONCESSION_BUDGET_CAP",
			Passed:   budgetPassed,
			Reason:   fmt.Sprintf("Concession ₹%.2f (capped at ₹500) vs available budget ₹%.2f", float64(concessionPaise)/100.0, float64(availableBudgetPaise)/100.0),
		})

		if !budgetPassed {
			isVetoed = true
			vetoAction = ActionEscalateHuman
			vetoReason = "Concession token budget depleted. Escalated to retention account manager."
		}
	} else {
		policyRules = append(policyRules, PolicyRuleEvaluation{
			RuleName: "CONCESSION_BUDGET_CAP",
			Passed:   true,
			Reason:   "Action requires no monetary concession spend",
		})
	}

	// 4. Construct Decision based on Policy Verdict
	if isVetoed {
		return Decision{
			CaseID:               caseID,
			Action:               vetoAction,
			Reasoning:            vetoReason,
			PolicyVerdict:        "VETOED",
			PolicyRules:          policyRules,
			MLRankings:           mlRankings,
			MLRecommendation:     topCandidate.Action,
			MLProbability:        topCandidate.Probability,
			MLExpectedValuePaise: topCandidate.ExpectedValuePaise,
			ShadowBandit:         rankResp.ShadowBandit,
			IsStoppingRuleHit:    true,
			StoppingReason:       vetoReason,
			MaxAttempts:          s.MaxAttemptsDefault,
			CurrentAttempt:       currentAttempts,
			NextExecutionAt:      now,
		}
	}

	// 5. Authorized Execution Parameters
	selectedAction := topCandidate.Action
	var cooldown time.Duration = 1 * time.Hour
	targetRail := originalRail

	switch selectedAction {
	case ActionRetrySameRailCooldown:
		cooldown = 4 * time.Hour
		targetRail = originalRail
	case ActionRetryLater:
		cooldown = 24 * time.Hour
		targetRail = originalRail
	case ActionRetryNextPaydayWindow:
		cooldown = 48 * time.Hour
		targetRail = originalRail
	case ActionSwitchRailUPI:
		cooldown = 15 * time.Minute
		targetRail = "UPI_INTENT"
	case ActionCustomerPaymentLink:
		cooldown = 30 * time.Minute
		targetRail = "PAYMENT_LINK"
	case ActionRetryAuthentication:
		cooldown = 20 * time.Minute
		targetRail = "WHATSAPP_NUDGE"
	case ActionIncentiveDiscount:
		cooldown = 2 * time.Hour
		targetRail = originalRail
	case ActionEscalateHuman:
		cooldown = 0
	case ActionStop:
		cooldown = 0
	}

	return Decision{
		CaseID:               caseID,
		Action:               selectedAction,
		Reasoning:            fmt.Sprintf("ML ranked '%s' highest with %.1f%% recovery probability (EV: ₹%.2f). Policy authorized execution.", selectedAction, topCandidate.Probability*100.0, float64(topCandidate.ExpectedValuePaise)/100.0),
		TargetRail:           targetRail,
		CooldownDuration:     cooldown,
		NextExecutionAt:      now.Add(cooldown),
		IncentiveAmountPaise: concessionPaise,
		IncentivePercent:     concessionPercent,
		PolicyVerdict:        "AUTHORIZED",
		PolicyRules:          policyRules,
		MLRankings:           mlRankings,
		MLRecommendation:     topCandidate.Action,
		MLProbability:        topCandidate.Probability,
		MLExpectedValuePaise: topCandidate.ExpectedValuePaise,
		ShadowBandit:         rankResp.ShadowBandit,
		IsStoppingRuleHit:    false,
		MaxAttempts:          s.MaxAttemptsDefault,
		CurrentAttempt:       nextAttempt,
	}
}

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

// ActionDecisionRationale explains exactly why an action was chosen, positive signals, rejected alternatives, and policy gates
type ActionDecisionRationale struct {
	RecommendedAction    string   `json:"recommended_action"`
	ExpectedRecoveryINR  float64  `json:"expected_recovery_inr"`
	RecoveryProbability  float64  `json:"recovery_probability"`
	PositiveSignals      []string `json:"positive_signals"`
	RejectedAlternatives []string `json:"rejected_alternatives"`
	PolicyPassedChecks   []string `json:"policy_passed_checks"`
}

// Decision contains the selected intervention, ML rankings, candidate provenance, and policy engine veto checks
type Decision struct {
	CaseID               string                      `json:"case_id"`
	Action               string                      `json:"action"`
	Reasoning            string                      `json:"reasoning"`
	TargetRail           string                      `json:"target_rail,omitempty"`
	CooldownDuration     time.Duration               `json:"cooldown_duration"`
	NextExecutionAt      time.Time                   `json:"next_execution_at"`
	IncentiveAmountPaise int64                       `json:"incentive_amount_paise,omitempty"`
	IncentivePercent     float64                     `json:"incentive_percent,omitempty"`
	IsStoppingRuleHit    bool                        `json:"is_stopping_rule_hit"`
	StoppingReason       string                      `json:"stopping_reason,omitempty"`
	PolicyVerdict        string                      `json:"policy_verdict"` // "AUTHORIZED" or "VETOED"
	PolicyRules          []PolicyRuleEvaluation      `json:"policy_rules"`
	CandidateEvaluations []CandidateEvaluation       `json:"candidate_evaluations,omitempty"`
	ActionRationale      *ActionDecisionRationale    `json:"action_rationale,omitempty"`
	MLRankings           []mlclient.RankedCandidate  `json:"ml_rankings,omitempty"`
	MLRecommendation     string                      `json:"ml_recommendation,omitempty"`
	MLProbability        float64                     `json:"ml_probability,omitempty"`
	MLExpectedValuePaise int64                       `json:"ml_expected_value_paise,omitempty"`
	ShadowBandit         *mlclient.ShadowBanditReport `json:"shadow_bandit,omitempty"`
	MaxAttempts          int                         `json:"max_attempts"`
	CurrentAttempt       int                         `json:"current_attempt"`
}

// Selector evaluates diagnosis, context-aware eligibility, ML ranking, and policy vetoes
type Selector struct {
	MaxAttemptsDefault   int
	MaxIncentiveCapPaise int64 // ₹500 (50,000 paise)
	HighValueThreshold   int64 // ₹10,000 (1,000,000 paise)
	MLClient             *mlclient.Client
	EligibilityEngine    *EligibilityEngine
}

// NewSelector creates a new intervention selector with ML client and eligibility engine
func NewSelector() *Selector {
	return &Selector{
		MaxAttemptsDefault:   3,
		MaxIncentiveCapPaise: 50000,   // ₹500 max concession per case
		HighValueThreshold:   1000000, // ₹10,000
		MLClient:             mlclient.NewClient("http://localhost:8000"),
		EligibilityEngine:    NewEligibilityEngine(),
	}
}

// SetMLClient overrides default ML client (e.g. for testing)
func (s *Selector) SetMLClient(client *mlclient.Client) {
	s.MLClient = client
}

// SelectIntervention ranks context-eligible candidate actions via ML and enforces deterministic policy authorization
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

	// Extract contextual features
	paydayProx := 10
	timeSinceFailH := 1.0
	hour := now.Hour()
	dayOfWeek := int(now.Weekday())
	histRate := 0.72
	hasAltCard := false
	altCardLabel := ""
	altCardSuccess := 0
	hasUPI := false

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
		if c, ok := ctx["has_alternate_saved_card"].(bool); ok {
			hasAltCard = c
		}
		if l, ok := ctx["alternate_saved_card_label"].(string); ok {
			altCardLabel = l
		}
		if s, ok := ctx["alternate_card_success_count"].(int); ok {
			altCardSuccess = s
		}
		if u, ok := ctx["has_upi_available"].(bool); ok {
			hasUPI = u
		}
	}

	// 1. CONTEXT-AWARE ELIGIBILITY ENGINE EVALUATION (Read-only context check)
	recCtx := BuildRecoveryContext(
		caseID,
		report.RootCause,
		amountPaise,
		originalRail,
		currentAttempts,
		s.MaxAttemptsDefault,
		paydayProx,
		histRate,
		timeSinceFailH,
		hasAltCard,
		altCardLabel,
		altCardSuccess,
		hasUPI,
	)

	candidateEvaluations := s.EligibilityEngine.EvaluateEligibility(recCtx)
	eligibleCandidates := s.EligibilityEngine.GetEligibleActionNames(recCtx)

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
		PreviousSuccessCount:  altCardSuccess,
		DaysSinceLastPayment:  25,
		CandidateActions:      eligibleCandidates,
	}

	// 2. ML SERVICE / RANDOM FOREST CANDIDATE RANKING
	rankResp := s.MLClient.RankCandidates(features)
	mlRankings := rankResp.RankedCandidates

	var topCandidate mlclient.RankedCandidate
	if len(mlRankings) > 0 {
		topCandidate = mlRankings[0]
	} else {
		topCandidate = mlclient.RankedCandidate{
			Action:             eligibleCandidates[0],
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
	actionPermitted := false
	for _, cand := range eligibleCandidates {
		if cand == topCandidate.Action {
			actionPermitted = true
			break
		}
	}
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "CANDIDATE_LEGITIMACY",
		Passed:   actionPermitted,
		Reason:   fmt.Sprintf("Action '%s' is verified in context-eligible candidate set", topCandidate.Action),
	})
	if !actionPermitted {
		isVetoed = true
		vetoAction = ActionEscalateHuman
		vetoReason = fmt.Sprintf("ML proposed non-eligible action '%s' for current context", topCandidate.Action)
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

	// Rule 3: Fraud Security Gate
	fraudPassed := report.RootCause != diagnosis.CauseFraudSuspected
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "FRAUD_SECURITY_GATE",
		Passed:   fraudPassed,
		Reason:   "Security anomaly and velocity check",
	})
	if !fraudPassed {
		isVetoed = true
		vetoAction = ActionEscalateHuman
		vetoReason = "Security flag triggered: transaction flagged as suspected fraud. Directing to risk officer."
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

	// Rule 5: Concession Budget Cap (≤5% of amount AND ≤₹500)
	concessionCapPassed := true
	incentiveAmountPaise := int64(0)
	if topCandidate.Action == ActionIncentiveDiscount {
		incentiveAmountPaise = int64(float64(amountPaise) * 0.05)
		if incentiveAmountPaise > s.MaxIncentiveCapPaise {
			incentiveAmountPaise = s.MaxIncentiveCapPaise
		}
		concessionCapPassed = incentiveAmountPaise <= s.MaxIncentiveCapPaise
	}
	policyRules = append(policyRules, PolicyRuleEvaluation{
		RuleName: "CONCESSION_BUDGET_CAP",
		Passed:   concessionCapPassed,
		Reason:   fmt.Sprintf("Concession ₹%.2f capped at ≤5%% AND ≤₹%.2f", float64(incentiveAmountPaise)/100.0, float64(s.MaxIncentiveCapPaise)/100.0),
	})

	// Build structured "Why this action?" signals
	positiveSignals := make([]string, 0)
	rejectedAlternatives := make([]string, 0)
	policyPassedList := make([]string, 0)

	for _, pr := range policyRules {
		if pr.Passed {
			policyPassedList = append(policyPassedList, pr.Reason)
		}
	}

	for _, ev := range candidateEvaluations {
		if ev.Action == topCandidate.Action {
			positiveSignals = append(positiveSignals, ev.Signals...)
		} else if !ev.Eligible {
			rejectedAlternatives = append(rejectedAlternatives, fmt.Sprintf("%s: %s", ev.DisplayName, ev.Reason))
		}
	}

	if len(mlRankings) > 1 {
		for _, runnerUp := range mlRankings[1:] {
			rejectedAlternatives = append(rejectedAlternatives, fmt.Sprintf("%s (Ranked lower by ML: %.1f%% EV: ₹%.2f)", runnerUp.Action, runnerUp.ProbabilityPercent, runnerUp.ExpectedValueINR))
		}
	}

	actionRationale := &ActionDecisionRationale{
		RecommendedAction:    topCandidate.Action,
		ExpectedRecoveryINR:  float64(topCandidate.ExpectedValuePaise) / 100.0,
		RecoveryProbability:  topCandidate.Probability,
		PositiveSignals:      positiveSignals,
		RejectedAlternatives: rejectedAlternatives,
		PolicyPassedChecks:   policyPassedList,
	}

	// 4. Construct Decision based on Policy Verdict
	if isVetoed {
		return Decision{
			CaseID:               caseID,
			Action:               vetoAction,
			Reasoning:            vetoReason,
			PolicyVerdict:        "VETOED",
			PolicyRules:          policyRules,
			CandidateEvaluations: candidateEvaluations,
			ActionRationale:      actionRationale,
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
	case ActionRetryNextPaydayWindow:
		cooldown = 48 * time.Hour
		targetRail = originalRail
	case ActionSwitchToSavedCard:
		cooldown = 10 * time.Minute
		targetRail = "SAVED_CARD"
	case ActionSwitchToAvailableAlternateRail:
		cooldown = 15 * time.Minute
		targetRail = "UPI_INTENT"
	case ActionResumeCheckout:
		cooldown = 15 * time.Minute
		targetRail = "WHATSAPP_NUDGE"
	case ActionUpdatePaymentMethod:
		cooldown = 20 * time.Minute
		targetRail = "HOSTED_CHECKOUT"
	case ActionReauthorizeMandate:
		cooldown = 2 * time.Hour
		targetRail = "MANDATE_AUTH"
	case ActionCollectOutstandingPayment:
		cooldown = 1 * time.Hour
		targetRail = "INVOICE"
	case ActionEscalateHuman, ActionStop:
		cooldown = 0
	}

	return Decision{
		CaseID:               caseID,
		Action:               selectedAction,
		Reasoning:            fmt.Sprintf("ML ranked '%s' highest with %.1f%% recovery probability (EV: ₹%.2f). Policy authorized execution.", selectedAction, topCandidate.Probability*100.0, float64(topCandidate.ExpectedValuePaise)/100.0),
		TargetRail:           targetRail,
		CooldownDuration:     cooldown,
		NextExecutionAt:      now.Add(cooldown),
		PolicyVerdict:        "AUTHORIZED",
		PolicyRules:          policyRules,
		CandidateEvaluations: candidateEvaluations,
		ActionRationale:      actionRationale,
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


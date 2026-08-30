package recovery

import (
	"fmt"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
)

// Plan status constants
const (
	PlanStatusActive    = "ACTIVE"
	PlanStatusCompleted = "COMPLETED"
	PlanStatusStopped   = "STOPPED"
	PlanStatusEscalated = "ESCALATED"
	PlanStatusExhausted = "MARK_LOST_EXHAUSTED"
)

// Step status constants
const (
	StepPending   = "PENDING"
	StepExecuting = "EXECUTING"
	StepSuccess   = "SUCCESS"
	StepFailure   = "FAILURE"
	StepSkipped   = "SKIPPED"
)

// PlanStep represents one bounded action in a recovery sequence
type PlanStep struct {
	StepIndex         int        `json:"step_index"`
	Action            string     `json:"action"`
	ScheduledAt       time.Time  `json:"scheduled_at"`
	CooldownDuration  string     `json:"cooldown_duration,omitempty"`
	Status            string     `json:"status"`
	SuccessTransition string     `json:"success_transition"` // "CLOSE" or next step index
	FailureTransition string     `json:"failure_transition"` // next step index or "ESCALATE"
	StopConditions    []string   `json:"stop_conditions,omitempty"`
	ExecutedAt        *time.Time `json:"executed_at,omitempty"`
	Result            string     `json:"result,omitempty"`
	IdempotencyKey    string     `json:"idempotency_key"`
}

// RecoveryPlan is a bounded sequence of recovery actions for a single case
type RecoveryPlan struct {
	CaseID           string     `json:"case_id"`
	Steps            []PlanStep `json:"steps"`
	MaxSteps         int        `json:"max_steps"`
	CurrentStepIndex int        `json:"current_step_index"`
	Status           string     `json:"status"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// CurrentStep returns the currently active step, or nil if the plan is terminal
func (rp *RecoveryPlan) CurrentStep() *PlanStep {
	if rp.CurrentStepIndex >= len(rp.Steps) {
		return nil
	}
	return &rp.Steps[rp.CurrentStepIndex]
}

// IsTerminal returns true if the plan has reached a terminal state
func (rp *RecoveryPlan) IsTerminal() bool {
	switch rp.Status {
	case PlanStatusCompleted, PlanStatusStopped, PlanStatusEscalated, PlanStatusExhausted:
		return true
	}
	return false
}

// AdvanceOnSuccess marks the current step as successful and completes the plan
func (rp *RecoveryPlan) AdvanceOnSuccess() {
	if rp.CurrentStepIndex < len(rp.Steps) {
		now := time.Now().UTC()
		rp.Steps[rp.CurrentStepIndex].Status = StepSuccess
		rp.Steps[rp.CurrentStepIndex].ExecutedAt = &now
		rp.Steps[rp.CurrentStepIndex].Result = "RECOVERED"
	}
	rp.Status = PlanStatusCompleted
	rp.UpdatedAt = time.Now().UTC()
}

// AdvanceOnFailure marks the current step as failed and moves to the next step
func (rp *RecoveryPlan) AdvanceOnFailure(reason string) {
	now := time.Now().UTC()
	if rp.CurrentStepIndex < len(rp.Steps) {
		rp.Steps[rp.CurrentStepIndex].Status = StepFailure
		rp.Steps[rp.CurrentStepIndex].ExecutedAt = &now
		rp.Steps[rp.CurrentStepIndex].Result = reason
	}
	rp.CurrentStepIndex++
	if rp.CurrentStepIndex >= len(rp.Steps) {
		// All steps exhausted → terminal
		rp.Status = PlanStatusExhausted
	}
	rp.UpdatedAt = now
}

// Stop terminates the plan immediately
func (rp *RecoveryPlan) Stop(reason string) {
	now := time.Now().UTC()
	if rp.CurrentStepIndex < len(rp.Steps) {
		rp.Steps[rp.CurrentStepIndex].Status = StepSkipped
		rp.Steps[rp.CurrentStepIndex].Result = reason
	}
	rp.Status = PlanStatusStopped
	rp.UpdatedAt = now
}

// Escalate transitions the plan to human escalation
func (rp *RecoveryPlan) Escalate(reason string) {
	now := time.Now().UTC()
	if rp.CurrentStepIndex < len(rp.Steps) {
		rp.Steps[rp.CurrentStepIndex].Status = StepSkipped
		rp.Steps[rp.CurrentStepIndex].Result = reason
	}
	rp.Status = PlanStatusEscalated
	rp.UpdatedAt = now
}

// BuildRecoveryPlan constructs a bounded recovery sequence based on root cause and eligible actions.
// Every plan terminates in: SUCCESS, STOP, ESCALATE_HUMAN, or MARK_LOST_EXHAUSTED.
// Maximum 5 steps. No infinite retry loops.
func BuildRecoveryPlan(caseID string, rootCause string, eligibleActions []string, amountPaise int64, hasBackupCard bool) *RecoveryPlan {
	now := time.Now().UTC()
	plan := &RecoveryPlan{
		CaseID:           caseID,
		MaxSteps:         5,
		CurrentStepIndex: 0,
		Status:           PlanStatusActive,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	steps := buildStepsForCause(caseID, rootCause, eligibleActions, amountPaise, hasBackupCard, now)
	plan.Steps = steps
	return plan
}

func buildStepsForCause(caseID, rootCause string, eligible []string, amountPaise int64, hasBackupCard bool, now time.Time) []PlanStep {
	var steps []PlanStep
	idx := 0

	isEligible := func(action string) bool {
		for _, a := range eligible {
			if a == action {
				return true
			}
		}
		return false
	}

	addStep := func(action string, cooldown time.Duration, successTrans, failureTrans string) {
		steps = append(steps, PlanStep{
			StepIndex:         idx,
			Action:            action,
			ScheduledAt:       now.Add(cooldown * time.Duration(idx)),
			CooldownDuration:  cooldown.String(),
			Status:            StepPending,
			SuccessTransition: successTrans,
			FailureTransition: failureTrans,
			StopConditions:    []string{"fraud_detected", "max_attempts_reached"},
			IdempotencyKey:    fmt.Sprintf("plan_%s_step_%d", caseID, idx),
		})
		idx++
	}

	switch rootCause {
	case diagnosis.CauseInsufficientFunds:
		if hasBackupCard && isEligible(intervention.ActionSwitchToSavedCard) {
			addStep(intervention.ActionSwitchToSavedCard, 0, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionRetryNextPaydayWindow) {
			addStep(intervention.ActionRetryNextPaydayWindow, 4*time.Hour, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionPromiseToPay) {
			addStep(intervention.ActionPromiseToPay, 2*time.Hour, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	case diagnosis.CauseBankDowntime:
		if isEligible(intervention.ActionRetrySameRailCooldown) {
			addStep(intervention.ActionRetrySameRailCooldown, 0, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionSwitchToAvailableAlternateRail) {
			addStep(intervention.ActionSwitchToAvailableAlternateRail, 4*time.Hour, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	case diagnosis.CauseExpiredCard:
		if isEligible(intervention.ActionUpdatePaymentMethod) {
			addStep(intervention.ActionUpdatePaymentMethod, 0, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	case diagnosis.CauseOtpDropoff:
		if isEligible(intervention.ActionResumeCheckout) {
			addStep(intervention.ActionResumeCheckout, 0, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionSwitchToAvailableAlternateRail) {
			addStep(intervention.ActionSwitchToAvailableAlternateRail, 15*time.Minute, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	case diagnosis.CauseMandateRevoked:
		if isEligible(intervention.ActionReauthorizeMandate) {
			addStep(intervention.ActionReauthorizeMandate, 0, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionCollectOutstandingPayment) {
			addStep(intervention.ActionCollectOutstandingPayment, 2*time.Hour, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	case diagnosis.CauseFraudSuspected:
		addStep(intervention.ActionStop, 0, "STOP", "STOP")

	case diagnosis.CauseNetworkDecline:
		if isEligible(intervention.ActionRetrySameRailCooldown) {
			addStep(intervention.ActionRetrySameRailCooldown, 0, "CLOSE", "NEXT")
		}
		if isEligible(intervention.ActionSwitchToAvailableAlternateRail) {
			addStep(intervention.ActionSwitchToAvailableAlternateRail, 2*time.Hour, "CLOSE", "NEXT")
		}
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")

	default:
		// Unknown → immediate escalation
		addStep(intervention.ActionEscalateHuman, 0, "CLOSE", "STOP")
	}

	return steps
}

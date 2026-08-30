package recovery

import (
	"testing"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
)

func TestBuildRecoveryPlan_AllRootCausesTerminate(t *testing.T) {
	causes := []string{
		diagnosis.CauseInsufficientFunds,
		diagnosis.CauseBankDowntime,
		diagnosis.CauseExpiredCard,
		diagnosis.CauseOtpDropoff,
		diagnosis.CauseMandateRevoked,
		diagnosis.CauseFraudSuspected,
		diagnosis.CauseNetworkDecline,
		diagnosis.CauseUnknown,
	}

	for _, cause := range causes {
		allowed := intervention.GetAllowedCandidates(cause)
		plan := BuildRecoveryPlan("CASE-TEST", cause, allowed, 500000, true)

		if plan == nil {
			t.Fatalf("Expected plan for cause %s, got nil", cause)
		}
		if len(plan.Steps) == 0 {
			t.Fatalf("Plan for cause %s has 0 steps", cause)
		}
		if len(plan.Steps) > 5 {
			t.Fatalf("Plan for cause %s exceeds maximum 5 steps: got %d", cause, len(plan.Steps))
		}

		// Verify fraud terminates immediately in STOP
		if cause == diagnosis.CauseFraudSuspected {
			if plan.Steps[0].Action != intervention.ActionStop {
				t.Fatalf("Expected STOP action for fraud, got %s", plan.Steps[0].Action)
			}
		}

		// Verify transitions
		plan.AdvanceOnFailure("declined")
		if plan.CurrentStepIndex != 1 {
			t.Errorf("Expected step index 1 after failure, got %d", plan.CurrentStepIndex)
		}

		plan.AdvanceOnSuccess()
		if plan.Status != PlanStatusCompleted {
			t.Errorf("Expected plan status COMPLETED on success, got %s", plan.Status)
		}
		if !plan.IsTerminal() {
			t.Errorf("Expected plan to be terminal")
		}
	}
}

func TestScheduler_AdvanceTimeAndTrigger(t *testing.T) {
	sched := NewScheduler()

	now := time.Now().UTC()
	step1 := &ScheduledStep{
		CaseID:         "CASE-1",
		StepIndex:      0,
		Action:         intervention.ActionRetrySameRailCooldown,
		ScheduledAt:    now.Add(2 * time.Hour),
		IdempotencyKey: "key-1",
	}
	step2 := &ScheduledStep{
		CaseID:         "CASE-2",
		StepIndex:      0,
		Action:         intervention.ActionRetryNextPaydayWindow,
		ScheduledAt:    now.Add(24 * time.Hour),
		IdempotencyKey: "key-2",
	}

	sched.Schedule(step1)
	sched.Schedule(step2)

	// No steps due initially
	due := sched.GetDueSteps()
	if len(due) != 0 {
		t.Fatalf("Expected 0 due steps initially, got %d", len(due))
	}

	// Advance by 3 hours -> step1 should be due, step2 not due
	sched.AdvanceTime(3 * time.Hour)
	due = sched.GetDueSteps()
	if len(due) != 1 {
		t.Fatalf("Expected 1 due step after 3h advance, got %d", len(due))
	}
	if due[0].CaseID != "CASE-1" {
		t.Errorf("Expected CASE-1 due, got %s", due[0].CaseID)
	}

	// Mark executed
	sched.MarkExecuted("CASE-1", 0)
	due = sched.GetDueSteps()
	if len(due) != 0 {
		t.Fatalf("Expected 0 due steps after execution, got %d", len(due))
	}
}

func TestCoordinator_SuppressionAndCooldown(t *testing.T) {
	coord := NewCoordinator()

	cases := []*Case{
		{
			ID:          "CASE-HIGH",
			CustomerID:  "cust_test_1",
			AmountPaise: 1800000, // ₹18,000
			Status:      StatusNew,
			SourceType:  SourceAbandonedCheckout,
		},
		{
			ID:          "CASE-LOW",
			CustomerID:  "cust_test_1",
			AmountPaise: 420000, // ₹4,200
			Status:      StatusNew,
			SourceType:  SourceFailedSubscription,
		},
	}

	// 1. High value case should PROCEED
	decHigh := coord.Evaluate("cust_test_1", "CASE-HIGH", 1800000, cases)
	if decHigh.Decision != CoordProceed {
		t.Errorf("Expected high value case to PROCEED, got %s: %s", decHigh.Decision, decHigh.Reason)
	}

	// 2. Low value case should be SUPPRESSED while higher value is active
	decLow := coord.Evaluate("cust_test_1", "CASE-LOW", 420000, cases)
	if decLow.Decision != CoordSuppress {
		t.Errorf("Expected low value case to be SUPPRESSED, got %s: %s", decLow.Decision, decLow.Reason)
	}

	// 3. Record contact -> Cooldown should activate
	coord.RecordContact("cust_test_1")
	decAfterContact := coord.Evaluate("cust_test_1", "CASE-HIGH", 1800000, cases)
	if decAfterContact.Decision != CoordDefer {
		t.Errorf("Expected case to be DEFERRED during cooldown, got %s: %s", decAfterContact.Decision, decAfterContact.Reason)
	}
}

func TestPrioritizer_ScoringAndOrdering(t *testing.T) {
	cases := []*Case{
		{
			ID:                    "CASE-LOW",
			CustomerID:            "cust_1",
			AmountPaise:           100000, // ₹1,000
			Status:                StatusNew,
			SourceType:            SourceFailedPayment,
			HistoricalSuccessRate: 0.50,
			CreatedAt:             time.Now().UTC().Add(-5 * time.Hour),
		},
		{
			ID:                    "CASE-HIGH",
			CustomerID:            "cust_2",
			AmountPaise:           5000000, // ₹50,000
			Status:                StatusNew,
			SourceType:            SourceAbandonedCheckout,
			HistoricalSuccessRate: 0.90,
			CreatedAt:             time.Now().UTC().Add(-10 * time.Minute),
		},
	}

	summary := PrioritizePortfolio(cases)
	if summary.TotalOpportunities != 2 {
		t.Fatalf("Expected 2 opportunities, got %d", summary.TotalOpportunities)
	}

	if summary.Queue[0].CaseID != "CASE-HIGH" {
		t.Errorf("Expected CASE-HIGH to be ranked #1, got %s", summary.Queue[0].CaseID)
	}
	if summary.Queue[0].PriorityRank != 1 {
		t.Errorf("Expected rank 1, got %d", summary.Queue[0].PriorityRank)
	}
	if summary.Queue[1].PriorityRank != 2 {
		t.Errorf("Expected rank 2, got %d", summary.Queue[1].PriorityRank)
	}
}

func TestCustomerValueFactor_ColdStartVsBadHistory(t *testing.T) {
	// 1. True Cold-Start (0 prior attempts) -> Neutral 1.0 multiplier
	coldStartCase := &Case{
		ID:                    "CASE-COLD",
		CustomerID:            "cust_new",
		AmountPaise:           100000,
		Status:                StatusNew,
		SourceType:            SourceFailedPayment,
		HistoricalAttempts:    0,
		HistoricalSuccessRate: 0.0,
		CreatedAt:             time.Now().UTC(),
	}
	coldExp := ComputePriority(coldStartCase)
	if coldExp.CustomerValueFactor != 1.0 {
		t.Errorf("Expected cold-start (0 attempts) to yield CustomerValueFactor=1.0, got %f", coldExp.CustomerValueFactor)
	}

	// 2. Genuinely Bad History (10 prior attempts, 0 successes) -> Maximum penalty 0.5 multiplier
	badHistoryCase := &Case{
		ID:                    "CASE-BAD",
		CustomerID:            "cust_bad",
		AmountPaise:           100000,
		Status:                StatusNew,
		SourceType:            SourceFailedPayment,
		HistoricalAttempts:    10,
		HistoricalSuccessRate: 0.0,
		CreatedAt:             time.Now().UTC(),
	}
	badExp := ComputePriority(badHistoryCase)
	if badExp.CustomerValueFactor != 0.5 {
		t.Errorf("Expected bad history (10 attempts, 0 success) to yield CustomerValueFactor=0.5, got %f", badExp.CustomerValueFactor)
	}

	// 3. Perfect History (10 prior attempts, 100% success) -> Maximum boost 1.5 multiplier
	perfectHistoryCase := &Case{
		ID:                    "CASE-PERFECT",
		CustomerID:            "cust_vip",
		AmountPaise:           100000,
		Status:                StatusNew,
		SourceType:            SourceFailedPayment,
		HistoricalAttempts:    10,
		HistoricalSuccessRate: 1.0,
		CreatedAt:             time.Now().UTC(),
	}
	perfExp := ComputePriority(perfectHistoryCase)
	if perfExp.CustomerValueFactor != 1.5 {
		t.Errorf("Expected perfect history to yield CustomerValueFactor=1.5, got %f", perfExp.CustomerValueFactor)
	}

	// 4. Average History (10 prior attempts, 50% success) -> Neutral 1.0 multiplier
	avgHistoryCase := &Case{
		ID:                    "CASE-AVG",
		CustomerID:            "cust_avg",
		AmountPaise:           100000,
		Status:                StatusNew,
		SourceType:            SourceFailedPayment,
		HistoricalAttempts:    10,
		HistoricalSuccessRate: 0.50,
		CreatedAt:             time.Now().UTC(),
	}
	avgExp := ComputePriority(avgHistoryCase)
	if avgExp.CustomerValueFactor != 1.0 {
		t.Errorf("Expected 50%% history to yield CustomerValueFactor=1.0, got %f", avgExp.CustomerValueFactor)
	}
}

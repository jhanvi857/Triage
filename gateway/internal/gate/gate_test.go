package gate

import (
	"testing"

	"github.com/ledger/gateway/internal/budget"
	"github.com/ledger/gateway/internal/catalog"
)

func TestGate_ApprovedFlow(t *testing.T) {
	bMgr := budget.NewManager(1000000) // ₹10,000.00
	cat := catalog.NewCatalog()
	g := NewGate(Config{ManualApprovalThresholdPaise: 500000}, bMgr, cat)

	req := Request{
		AgentID:              "agent_alpha",
		ProductID:            "prod_gpu_h100", // ₹3,600.00
		Quantity:             1,
		StatedAmountPaise:    360000,
		StatedAgentReasoning: "Need 1 hour GPU compute for embedding generation pipeline",
	}

	report, prod, totalPaise, err := g.Evaluate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.Verdict != VerdictApproved {
		t.Fatalf("expected VERDICT_APPROVED, got %s (reason: %s)", report.Verdict, report.PrimaryReason)
	}
	if totalPaise != 360000 || prod.ID != "prod_gpu_h100" {
		t.Fatalf("expected total 360000 paise, got %d", totalPaise)
	}
	if len(report.EvaluatedRules) < 4 {
		t.Fatalf("expected at least 4 rule evaluations, got %d", len(report.EvaluatedRules))
	}
}

func TestGate_OverBudgetRejection(t *testing.T) {
	bMgr := budget.NewManager(1000000) // ₹10,000.00
	cat := catalog.NewCatalog()
	g := NewGate(Config{ManualApprovalThresholdPaise: 500000}, bMgr, cat)

	req := Request{
		AgentID:              "agent_budget_breaker",
		ProductID:            "prod_datacenter_node", // ₹25,000.00
		Quantity:             1,
		StatedAmountPaise:    2500000,
		StatedAgentReasoning: "Acquiring entire datacenter supercluster for training run",
	}

	report, _, _, err := g.Evaluate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.Verdict != VerdictRejected {
		t.Fatalf("expected REJECTED, got %s", report.Verdict)
	}

	foundBudgetRule := false
	for _, r := range report.EvaluatedRules {
		if r.RuleName == RuleBudgetSpendLimit {
			foundBudgetRule = true
			if r.Passed {
				t.Fatalf("expected budget rule to fail")
			}
		}
	}
	if !foundBudgetRule {
		t.Fatalf("RuleBudgetSpendLimit was not evaluated")
	}
}

func TestGate_HighValuePendingApproval(t *testing.T) {
	bMgr := budget.NewManager(1000000) // ₹10,000.00
	cat := catalog.NewCatalog()
	g := NewGate(Config{ManualApprovalThresholdPaise: 500000}, bMgr, cat) // ₹5,000 threshold

	req := Request{
		AgentID:              "agent_power_user",
		ProductID:            "prod_enterprise_ai", // ₹7,500.00
		Quantity:             1,
		StatedAmountPaise:    750000,
		StatedAgentReasoning: "Deploying enterprise multi-agent sandbox license for automated QA",
	}

	report, _, totalPaise, err := g.Evaluate(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report.Verdict != VerdictPendingApproval {
		t.Fatalf("expected PENDING_APPROVAL, got %s (reason: %s)", report.Verdict, report.PrimaryReason)
	}
	if totalPaise != 750000 {
		t.Fatalf("expected total 750000, got %d", totalPaise)
	}
}

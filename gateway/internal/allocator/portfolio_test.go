package allocator

import (
	"testing"
	"time"

	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/recovery"
)

func TestPortfolioAllocator_SmallHighUpliftBeatsLargeLowUplift(t *testing.T) {
	// Proves that knapsack allocation ranks by EV density (rho) rather than raw amount sorting.
	// Case 1 (Small): ₹2,000 amount, high uplift with discount (Payday 14 days away) -> high EV density
	// Case 2 (Large): ₹8,000 amount, low uplift with discount (Payday 1 day away) -> lower EV density
	alloc := NewPortfolioAllocator()
	now := time.Now().UTC()

	smallCase := &recovery.Case{
		ID:                  "CASE-SMALL",
		CustomerName:        "Small High-Uplift User",
		AmountPaise:         200000, // ₹2,000
		AmountINR:           2000.0,
		PaydayProximityDays: 14,
		Diagnosis: &diagnosis.DiagnosticReport{
			RootCause: "INSUFFICIENT_FUNDS",
		},
		CreatedAt: now,
	}

	largeCase := &recovery.Case{
		ID:                  "CASE-LARGE",
		CustomerName:        "Large Low-Uplift User",
		AmountPaise:         800000, // ₹8,000
		AmountINR:           8000.0,
		PaydayProximityDays: 1, // Already near payday, so standard retry has 75% recovery
		Diagnosis: &diagnosis.DiagnosticReport{
			RootCause: "INSUFFICIENT_FUNDS",
		},
		CreatedAt: now,
	}

	// Tight budget: only ₹150 discount budget (15,000 paise)
	// Small case discount is ₹100 (10,000 paise)
	// Large case discount is ₹400 (40,000 paise)
	// Budget can only afford the small case!
	plan := alloc.OptimizePortfolio([]*recovery.Case{largeCase, smallCase}, 15000, 5)

	if plan.CasesAllocatedDiscount != 1 {
		t.Fatalf("expected 1 discount allocation, got %d", plan.CasesAllocatedDiscount)
	}

	var smallDecision, largeDecision *AllocationDecision
	for i := range plan.Decisions {
		if plan.Decisions[i].CaseID == "CASE-SMALL" {
			smallDecision = &plan.Decisions[i]
		}
		if plan.Decisions[i].CaseID == "CASE-LARGE" {
			largeDecision = &plan.Decisions[i]
		}
	}

	if smallDecision == nil || largeDecision == nil {
		t.Fatalf("missing decisions for small or large cases")
	}

	if smallDecision.ResourceAllocated != "DISCOUNT_BUDGET" {
		t.Errorf("expected small high-uplift case to receive DISCOUNT_BUDGET, got %s", smallDecision.ResourceAllocated)
	}

	if smallDecision.EVDensity <= largeDecision.EVDensity {
		t.Errorf("expected small case EV density (%.2f) to exceed large case EV density (%.2f)", smallDecision.EVDensity, largeDecision.EVDensity)
	}

	if largeDecision.ResourceAllocated != "ZERO_COST_FALLBACK" {
		t.Errorf("expected large case to fall back to ZERO_COST_FALLBACK, got %s", largeDecision.ResourceAllocated)
	}
}

func TestPortfolioAllocator_BudgetExhaustionAndFallbacks(t *testing.T) {
	alloc := NewPortfolioAllocator()
	now := time.Now().UTC()

	cases := []*recovery.Case{
		{
			ID:                  "CASE-001",
			CustomerName:        "Customer 1 (Mid-month)",
			AmountPaise:         300000, // ₹3k (5% discount = ₹150 / 15,000 paise)
			PaydayProximityDays: 12,
			Diagnosis:           &diagnosis.DiagnosticReport{RootCause: "INSUFFICIENT_FUNDS"},
			CreatedAt:           now,
		},
		{
			ID:                  "CASE-002",
			CustomerName:        "Customer 2 (Mid-month)",
			AmountPaise:         400000, // ₹4k (5% discount = ₹200 / 20,000 paise)
			PaydayProximityDays: 12,
			Diagnosis:           &diagnosis.DiagnosticReport{RootCause: "INSUFFICIENT_FUNDS"},
			CreatedAt:           now,
		},
		{
			ID:                  "CASE-003",
			CustomerName:        "Customer 3 (Enterprise)",
			AmountPaise:         1200000, // ₹12k -> Enterprise human desk
			PaydayProximityDays: 12,
			Diagnosis:           &diagnosis.DiagnosticReport{RootCause: "MANDATE_REVOKED"},
			CreatedAt:           now,
		},
	}

	// Budget only enough for 1 discount (₹180 / 18,000 paise) and 1 human desk slot
	plan := alloc.OptimizePortfolio(cases, 18000, 1)

	if plan.CasesAllocatedHumanDesk != 1 {
		t.Errorf("expected 1 human desk allocation, got %d", plan.CasesAllocatedHumanDesk)
	}
	if plan.CasesAllocatedDiscount != 1 {
		t.Errorf("expected 1 discount allocation, got %d", plan.CasesAllocatedDiscount)
	}
	if plan.CasesRoutedZeroCostFallback != 1 {
		t.Errorf("expected 1 zero-cost fallback, got %d", plan.CasesRoutedZeroCostFallback)
	}
	if plan.DiscountBudgetSpentPaise > 18000 {
		t.Errorf("discount spent %d exceeded limit 18000", plan.DiscountBudgetSpentPaise)
	}
}

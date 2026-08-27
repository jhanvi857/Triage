package budget

import (
	"sync"
	"testing"
)

func TestBudgetManager_ReserveAndCommit(t *testing.T) {
	mgr := NewManager(1000000) // ₹10,000.00
	agentID := "agent_gpu_bot"

	// Check initial state
	snap := mgr.GetSnapshot(agentID)
	if snap.RemainingPaise != 1000000 || snap.SpentPaise != 0 {
		t.Fatalf("expected 1000000 remaining and 0 spent, got %d / %d", snap.RemainingPaise, snap.SpentPaise)
	}

	// Reserve ₹3,500 (350000 paise)
	resID := "res_001"
	err := mgr.Reserve(agentID, resID, 350000)
	if err != nil {
		t.Fatalf("unexpected error on reserve: %v", err)
	}

	snap = mgr.GetSnapshot(agentID)
	if snap.ReservedPaise != 350000 {
		t.Fatalf("expected 350000 reserved, got %d", snap.ReservedPaise)
	}

	// Commit reservation
	err = mgr.Commit(agentID, resID, 350000)
	if err != nil {
		t.Fatalf("unexpected error on commit: %v", err)
	}

	snap = mgr.GetSnapshot(agentID)
	if snap.RemainingPaise != 650000 || snap.SpentPaise != 350000 || snap.ReservedPaise != 0 {
		t.Fatalf("state mismatch after commit: remaining=%d, spent=%d, reserved=%d",
			snap.RemainingPaise, snap.SpentPaise, snap.ReservedPaise)
	}
}

func TestBudgetManager_ExceedsBudget(t *testing.T) {
	mgr := NewManager(500000) // ₹5,000.00
	agentID := "agent_frugal"

	// Try reserving ₹6,000 (600000 paise)
	err := mgr.Reserve(agentID, "res_too_large", 600000)
	if err == nil {
		t.Fatalf("expected error for over-budget request, got nil")
	}

	var budgetErr *ErrInsufficientBudget
	if !errorsAs(err, &budgetErr) {
		t.Fatalf("expected ErrInsufficientBudget, got: %T (%v)", err, err)
	}
	if budgetErr.RequiredPaise != 600000 || budgetErr.AvailablePaise != 500000 {
		t.Fatalf("unexpected error values: %+v", budgetErr)
	}
}

func errorsAs(err error, target any) bool {
	if err == nil {
		return false
	}
	if bErr, ok := target.(**ErrInsufficientBudget); ok {
		if val, match := err.(*ErrInsufficientBudget); match {
			*bErr = val
			return true
		}
	}
	return false
}

func TestBudgetManager_Concurrency(t *testing.T) {
	mgr := NewManager(1000000) // ₹10,000.00
	agentID := "agent_concurrent"

	var wg sync.WaitGroup
	numWorkers := 10
	amountPerWorker := int64(100000) // ₹1,000 each = exactly 10,000 total

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			resID := "res_concurrent_" + string(rune('A'+idx))
			err := mgr.Reserve(agentID, resID, amountPerWorker)
			if err == nil {
				_ = mgr.Commit(agentID, resID, amountPerWorker)
			}
		}(i)
	}

	wg.Wait()

	snap := mgr.GetSnapshot(agentID)
	if snap.RemainingPaise != 0 || snap.SpentPaise != 1000000 {
		t.Fatalf("expected exactly 0 remaining and 1000000 spent, got %d / %d", snap.RemainingPaise, snap.SpentPaise)
	}

	// Next reservation should fail
	err := mgr.Reserve(agentID, "res_overflow", 100)
	if err == nil {
		t.Fatalf("expected overflow reservation to fail")
	}
}

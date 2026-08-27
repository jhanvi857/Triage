package recovery

import (
	"testing"
	"time"
)

func TestRecoveryManager_HashChainingAndTransitions(t *testing.T) {
	mgr := NewManager()

	c := &Case{
		ID:           "CASE-TEST-1",
		CustomerName: "Test Corp",
		AmountPaise:  500000,
		Status:       StatusNew,
		CreatedAt:    time.Now().UTC(),
	}

	mgr.SaveCase(c, "DETECTED", "Initial failure")
	c.Status = StatusDiagnosed
	mgr.SaveCase(c, "DIAGNOSED", "Bank timeout diagnosed")
	c.Status = StatusRecovered
	c.RecoveredAmountPaise = 500000
	mgr.SaveCase(c, "RECOVERED", "Payment captured")

	stats := mgr.GetStats()
	if stats.TotalRecoveredPaise != 500000 {
		t.Errorf("expected ₹5000 recovered, got %d paise", stats.TotalRecoveredPaise)
	}

	if stats.TotalBlocks < 3 {
		t.Errorf("expected at least 3 hash blocks, got %d", stats.TotalBlocks)
	}
}

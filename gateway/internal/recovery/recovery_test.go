package recovery

import (
	"strings"
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

	// Must use RecordCapture as the sole write path for RECOVERED
	cRecovered, err := mgr.RecordCapture(c.ID, "pay_test_123", 500000, 0, "TEST_CAPTURE", "Payment captured")
	if err != nil {
		t.Fatalf("unexpected error from RecordCapture: %v", err)
	}

	if cRecovered.Status != StatusRecovered {
		t.Fatalf("expected StatusRecovered, got %s", cRecovered.Status)
	}

	stats := mgr.GetStats()
	if stats.TotalRecoveredPaise != 500000 {
		t.Errorf("expected ₹5000 recovered, got %d paise", stats.TotalRecoveredPaise)
	}

	if stats.TotalBlocks < 3 {
		t.Errorf("expected at least 3 hash blocks, got %d", stats.TotalBlocks)
	}
}

func TestRecoveryManager_StructuralInvariant_DirectRecoveryMutationBlocked(t *testing.T) {
	mgr := NewManager()

	c := &Case{
		ID:           "CASE-TEST-ROGUE",
		CustomerName: "Rogue Caller Corp",
		AmountPaise:  1000000,
		Status:       StatusNew,
		CreatedAt:    time.Now().UTC(),
	}
	mgr.SaveCase(c, "DETECTED", "Initial failure")

	// Assert that attempting to directly set Status = StatusRecovered via SaveCase PANICS
	defer func() {
		r := recover()
		if r == nil {
			t.Fatalf("STRUCTURAL INVARIANT VIOLATION: expected SaveCase to panic on rogue direct transition to StatusRecovered, but it succeeded!")
		}
		errMsg, ok := r.(string)
		if !ok || !strings.Contains(errMsg, "STRUCTURAL INVARIANT VIOLATION") {
			t.Fatalf("unexpected panic message: %v", r)
		}
	}()

	// Rogue direct mutation attempt on active case:
	c.Status = StatusRecovered
	mgr.SaveCase(c, "ROGUE_SETTLE", "Bypassing RecordCapture")
}

func TestRecoveryManager_DirectCreationAsRecoveredBlocked(t *testing.T) {
	mgr := NewManager()

	// Assert that attempting to create a brand new case directly as StatusRecovered via SaveCase PANICS
	defer func() {
		r := recover()
		if r == nil {
			t.Fatalf("STRUCTURAL INVARIANT VIOLATION: expected SaveCase to panic on creating brand new case as StatusRecovered, but it succeeded!")
		}
		errMsg, ok := r.(string)
		if !ok || !strings.Contains(errMsg, "STRUCTURAL INVARIANT VIOLATION") {
			t.Fatalf("unexpected panic message: %v", r)
		}
	}()

	cNew := &Case{
		ID:           "CASE-TEST-NEW-ROGUE",
		CustomerName: "Direct Creation Rogue",
		AmountPaise:  750000,
		Status:       StatusRecovered, // Rogue initial state
		CreatedAt:    time.Now().UTC(),
	}
	mgr.SaveCase(cNew, "ROGUE_NEW", "Initial creation directly as RECOVERED")
}

func TestRecoveryManager_LegitimateResaveOfRecoveredCaseSucceeds(t *testing.T) {
	mgr := NewManager()

	c := &Case{
		ID:           "CASE-TEST-LEGIT",
		CustomerName: "Legit Customer Inc",
		AmountPaise:  800000,
		Status:       StatusNew,
		CreatedAt:    time.Now().UTC(),
	}
	mgr.SaveCase(c, "DETECTED", "Initial failure")

	// 1. Authoritative capture transition via RecordCapture (the one legitimate key)
	cRecovered, err := mgr.RecordCapture(c.ID, "pay_legit_456", 800000, 0, "CARD_CHARGE", "Payment confirmed captured")
	if err != nil {
		t.Fatalf("unexpected error from RecordCapture: %v", err)
	}
	if cRecovered.Status != StatusRecovered {
		t.Fatalf("expected StatusRecovered, got %s", cRecovered.Status)
	}

	// 2. Legitimate subsequent resave on the already-recovered case (e.g. updating notes, recording post-capture refund metadata)
	cRecovered.Notes = "Customer requested tax receipt resend"
	cRecovered.AmountRefundedPaise = 0

	// Must succeed without panicking!
	mgr.SaveCase(cRecovered, "METADATA_UPDATE", "Updated notes and refund field on recovered case")

	// Verify the updated case is persisted properly
	savedCase, exists := mgr.GetCase("CASE-TEST-LEGIT")
	if !exists {
		t.Fatalf("expected case to exist")
	}
	if savedCase.Notes != "Customer requested tax receipt resend" {
		t.Fatalf("expected updated notes to be persisted, got '%s'", savedCase.Notes)
	}
	if savedCase.Status != StatusRecovered {
		t.Fatalf("expected status to remain StatusRecovered, got '%s'", savedCase.Status)
	}
}

func TestRecoveryManager_StatusDowngradeOfRecoveredCaseBlocked(t *testing.T) {
	mgr := NewManager()

	c := &Case{
		ID:           "CASE-TEST-DOWNGRADE",
		CustomerName: "Downgrade Target Corp",
		AmountPaise:  600000,
		Status:       StatusNew,
		CreatedAt:    time.Now().UTC(),
	}
	mgr.SaveCase(c, "DETECTED", "Initial failure")

	// Legitimately recover via RecordCapture
	cRecovered, err := mgr.RecordCapture(c.ID, "pay_down_123", 600000, 0, "UPI_PAY", "Authoritative UPI payment captured")
	if err != nil {
		t.Fatalf("unexpected error from RecordCapture: %v", err)
	}
	if cRecovered.Status != StatusRecovered {
		t.Fatalf("expected StatusRecovered, got %s", cRecovered.Status)
	}

	// Assert that attempting to downgrade status away from StatusRecovered (e.g. to StatusDiagnosed or StatusLost) via SaveCase PANICS
	defer func() {
		r := recover()
		if r == nil {
			t.Fatalf("STRUCTURAL INVARIANT VIOLATION: expected SaveCase to panic on illegal status downgrade away from StatusRecovered, but it succeeded!")
		}
		errMsg, ok := r.(string)
		if !ok || !strings.Contains(errMsg, "illegal status downgrade of recovered case") {
			t.Fatalf("unexpected panic message: %v", r)
		}
	}()

	// Rogue downgrade attempt:
	cRecovered.Status = StatusDiagnosed
	mgr.SaveCase(cRecovered, "ROGUE_DOWNGRADE", "Attempting to erase recovered state")
}

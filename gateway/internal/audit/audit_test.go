package audit

import (
	"testing"
	"time"
)

func TestAuditLogger_HashChainIntegrity(t *testing.T) {
	logger := NewLogger()

	logger.Append(Entry{
		AgentID:      "agent_001",
		Action:       ActionPurchaseInitiated,
		Reasoning:    "Initial request for compute",
		GateDecision: "APPROVED",
		GateReason:   "Within budget",
		AmountPaise:  360000,
		OrderID:      "ord_001",
		Status:       "PAID",
	})

	logger.Append(Entry{
		AgentID:      "agent_001",
		Action:       ActionPurchaseInitiated,
		Reasoning:    "Second request",
		GateDecision: "REJECTED",
		GateReason:   "Budget exceeded",
		AmountPaise:  2500000,
		Status:       "REJECTED",
	})

	valid, count, err := logger.VerifyIntegrity()
	if err != nil || !valid {
		t.Fatalf("expected valid hash chain, got valid=%v, count=%d, err=%v", valid, count, err)
	}
	if count != 2 {
		t.Fatalf("expected count 2, got %d", count)
	}
}

func TestAuditLogger_LiveSubscription(t *testing.T) {
	logger := NewLogger()
	ch := logger.Subscribe()
	defer logger.Unsubscribe(ch)

	go func() {
		time.Sleep(10 * time.Millisecond)
		logger.Append(Entry{
			AgentID:      "agent_stream_test",
			Action:       ActionPurchaseInitiated,
			GateDecision: "APPROVED",
		})
	}()

	select {
	case entry := <-ch:
		if entry.AgentID != "agent_stream_test" {
			t.Fatalf("expected agent_stream_test, got %s", entry.AgentID)
		}
	case <-time.After(500 * time.Millisecond):
		t.Fatalf("timed out waiting for live audit broadcast")
	}
}

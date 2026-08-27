package idempotency

import (
	"errors"
	"testing"
	"time"
)

func TestIdempotencyStore_ReplayAndDeduplication(t *testing.T) {
	store := NewStore(1 * time.Hour)
	key := "idem_tx_12345"
	agentID := "agent_buyer_01"
	reqHash := ComputeHash("agent_buyer_01", "prod_gpu_h100", "1", "360000")

	// 1. First acquire: should succeed as new
	rec, isNew, err := store.Acquire(key, agentID, reqHash)
	if err != nil || !isNew {
		t.Fatalf("expected new acquire, got isNew=%v, err=%v", isNew, err)
	}
	if rec.Status != StatusProcessing {
		t.Fatalf("expected status PROCESSING, got %s", rec.Status)
	}

	// 2. Concurrent acquire while still PROCESSING: should error with conflict
	_, _, err = store.Acquire(key, agentID, reqHash)
	if !errors.Is(err, ErrConflictInFlight) {
		t.Fatalf("expected ErrConflictInFlight, got %v", err)
	}

	// 3. Mark COMPLETED
	cachedPayload := []byte(`{"status":"PAID","order_id":"ord_test_999"}`)
	err = store.Complete(key, 200, cachedPayload)
	if err != nil {
		t.Fatalf("complete error: %v", err)
	}

	// 4. Retry with exact same key and hash: should return cached payload without being new
	rec2, isNew2, err := store.Acquire(key, agentID, reqHash)
	if err != nil {
		t.Fatalf("expected successful cached fetch, got err=%v", err)
	}
	if isNew2 {
		t.Fatalf("expected isNew=false for completed key")
	}
	if string(rec2.ResponseBody) != string(cachedPayload) {
		t.Fatalf("expected response body %s, got %s", string(cachedPayload), string(rec2.ResponseBody))
	}

	// 5. Tampered request with same key but different payload: must fail
	diffHash := ComputeHash("agent_buyer_01", "prod_datacenter_node", "1", "2500000")
	_, _, err = store.Acquire(key, agentID, diffHash)
	if !errors.Is(err, ErrPayloadMismatch) {
		t.Fatalf("expected ErrPayloadMismatch, got %v", err)
	}
}

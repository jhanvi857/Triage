package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func setupTestServer(t *testing.T) (*Server, func()) {
	tmpDB := "test_ledger_" + t.Name() + ".db"
	cfg := Config{
		ManualApprovalThresholdPaise: 500000,  // ₹5,000.00
		DefaultAgentCapacityPaise:    1000000, // ₹10,000.00
		RazorpayKeyID:                "mock",
		DBPath:                       tmpDB,
	}

	server, err := NewServer(cfg)
	if err != nil {
		t.Fatalf("failed to create test server: %v", err)
	}

	cleanup := func() {
		_ = server.storage.Close()
		_ = os.Remove(tmpDB)
	}

	return server, cleanup
}

func TestAPI_HappyPathPurchase(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	reqBody := `{"agent_id":"agent_test_01","product_id":"prod_gpu_h100","quantity":1,"stated_amount_paise":360000,"reasoning":"Model training","idempotency_key":"idem_happy_01"}`
	httpReq := httptest.NewRequest("POST", "/api/v1/purchase/initiate", bytes.NewReader([]byte(reqBody)))
	w := httptest.NewRecorder()

	server.ServeHTTP(w, httpReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if resp["status"] != "PAID" {
		t.Fatalf("expected PAID status, got %v", resp["status"])
	}
	if resp["razorpay_order_id"] == nil || resp["razorpay_payment_id"] == nil {
		t.Fatalf("missing razorpay order or payment id in response: %+v", resp)
	}
}

func TestAPI_OverBudgetRejection(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// prod_datacenter_node is ₹25,000 (2500000 paise), exceeding ₹10,000 cap
	reqBody := `{"agent_id":"agent_test_02","product_id":"prod_datacenter_node","quantity":1,"reasoning":"Over budget attempt","idempotency_key":"idem_over_01"}`
	httpReq := httptest.NewRequest("POST", "/api/v1/purchase/initiate", bytes.NewReader([]byte(reqBody)))
	w := httptest.NewRecorder()

	server.ServeHTTP(w, httpReq)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for over-budget, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "REJECTED" {
		t.Fatalf("expected REJECTED status, got %v", resp["status"])
	}
	if resp["error_code"] != "GATE_REJECTED" {
		t.Fatalf("expected error_code GATE_REJECTED, got %v", resp["error_code"])
	}
}

func TestAPI_HighValueThresholdAndApproval(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	// prod_enterprise_ai is ₹7,500 (> ₹5,000 threshold)
	reqBody := `{"agent_id":"agent_test_03","product_id":"prod_enterprise_ai","quantity":1,"reasoning":"Enterprise AI deployment","idempotency_key":"idem_gate_01"}`
	httpReq := httptest.NewRequest("POST", "/api/v1/purchase/initiate", bytes.NewReader([]byte(reqBody)))
	w := httptest.NewRecorder()

	server.ServeHTTP(w, httpReq)

	if w.Code != http.StatusAccepted {
		t.Fatalf("expected status 202 Accepted for gated transaction, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["status"] != "PENDING_APPROVAL" {
		t.Fatalf("expected PENDING_APPROVAL, got %v", resp["status"])
	}

	approvalID, ok := resp["approval_id"].(string)
	if !ok || approvalID == "" {
		t.Fatalf("missing approval_id in response: %+v", resp)
	}

	// Now approve the transaction
	approveReq := httptest.NewRequest("POST", "/api/v1/approvals/"+approvalID+"/approve", nil)
	wApprove := httptest.NewRecorder()
	server.ServeHTTP(wApprove, approveReq)

	if wApprove.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on approve, got %d: %s", wApprove.Code, wApprove.Body.String())
	}

	var approveResp map[string]interface{}
	_ = json.Unmarshal(wApprove.Body.Bytes(), &approveResp)
	if approveResp["status"] != "APPROVED" {
		t.Fatalf("expected status APPROVED, got %v", approveResp["status"])
	}
}

func TestAPI_IdempotentReplayNoDoubleCharge(t *testing.T) {
	server, cleanup := setupTestServer(t)
	defer cleanup()

	reqBody := `{"agent_id":"agent_idem_test","product_id":"prod_ai_tokens","quantity":1,"reasoning":"Token purchase","idempotency_key":"idem_repeat_123"}`

	// First request
	httpReq1 := httptest.NewRequest("POST", "/api/v1/purchase/initiate", bytes.NewReader([]byte(reqBody)))
	w1 := httptest.NewRecorder()
	server.ServeHTTP(w1, httpReq1)

	if w1.Code != http.StatusOK {
		t.Fatalf("expected 200 on first request, got %d", w1.Code)
	}

	var resp1 map[string]interface{}
	_ = json.Unmarshal(w1.Body.Bytes(), &resp1)
	ordID1 := resp1["order_id"]

	// Second request with SAME idempotency key (simulating retry)
	httpReq2 := httptest.NewRequest("POST", "/api/v1/purchase/initiate", bytes.NewReader([]byte(reqBody)))
	w2 := httptest.NewRecorder()
	server.ServeHTTP(w2, httpReq2)

	if w2.Code != http.StatusOK {
		t.Fatalf("expected 200 on replayed request, got %d", w2.Code)
	}

	var resp2 map[string]interface{}
	_ = json.Unmarshal(w2.Body.Bytes(), &resp2)
	ordID2 := resp2["order_id"]

	if ordID1 != ordID2 {
		t.Fatalf("expected identical order ID from replay cache, got %v vs %v", ordID1, ordID2)
	}

	// Verify agent was charged only once (spent should be ₹1,800, NOT ₹3,600)
	snap := server.budgetMgr.GetSnapshot("agent_idem_test")
	if snap.SpentPaise != 180000 {
		t.Fatalf("expected spent 180000 paise (₹1,800), got %d (double charged!)", snap.SpentPaise)
	}
}

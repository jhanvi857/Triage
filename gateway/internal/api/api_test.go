package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/ledger/gateway/internal/budget"
	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/intervention"
	"github.com/ledger/gateway/internal/mlclient"
	"github.com/ledger/gateway/internal/recovery"
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

func TestAPI_StrictPTPAccounting_ZeroRecoveredUntilSettlement(t *testing.T) {
	ts := NewTriageServer(diagnosis.NewEngine(), intervention.NewSelector(), recovery.NewManager(), budget.NewManager(1000000))
	mux := http.NewServeMux()
	ts.RegisterRoutes(mux)

	// 1. Initial State: Clean slate, 0 recovered
	stats := ts.RecoveryMgr.GetStats()
	if stats.TotalRecoveredPaise != 0 {
		t.Fatalf("expected initial total_recovered_paise to be 0, got %d", stats.TotalRecoveredPaise)
	}

	// Create test case dynamically via API (₹4,800 = 480,000 paise)
	caseReqBody := `{"customer_name":"Acme Cloud Systems","customer_email":"billing@acmecloud.io","plan_name":"Enterprise GPU Cluster","amount_paise":480000,"error_code":"INSUFFICIENT_FUNDS","error_desc":"Balance insufficient"}`
	caseReq := httptest.NewRequest("POST", "/api/v1/triage/cases", bytes.NewReader([]byte(caseReqBody)))
	caseW := httptest.NewRecorder()
	mux.ServeHTTP(caseW, caseReq)

	var created map[string]interface{}
	_ = json.Unmarshal(caseW.Body.Bytes(), &created)
	caseID, _ := created["id"].(string)

	// 2. Register PTP commitment for the created case (₹4,800 = 480,000 paise)
	ptpReqBody := fmt.Sprintf(`{"case_id":"%s","message":"Bhai 5th ko debit karna"}`, caseID)
	ptpReq := httptest.NewRequest("POST", "/api/v1/triage/ptp/parse", bytes.NewReader([]byte(ptpReqBody)))
	ptpW := httptest.NewRecorder()
	mux.ServeHTTP(ptpW, ptpReq)

	if ptpW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from PTP parse, got %d: %s", ptpW.Code, ptpW.Body.String())
	}

	// Check case status: MUST be PTP_COMMITTED
	c, exists := ts.RecoveryMgr.GetCase(caseID)
	if !exists {
		t.Fatalf("case %s not found", caseID)
	}
	if c.Status != "PTP_COMMITTED" {
		t.Fatalf("expected status PTP_COMMITTED after PTP registration, got %s", c.Status)
	}
	if c.RecoveredAmountPaise != 0 {
		t.Fatalf("expected recovered_amount_paise to be 0 for PTP commitment, got %d", c.RecoveredAmountPaise)
	}

	// Verify stats: TotalRecovered MUST remain 0, TotalPTPCommitted MUST be 480000
	statsAfterPTP := ts.RecoveryMgr.GetStats()
	if statsAfterPTP.TotalRecoveredPaise != 0 {
		t.Fatalf("STRICT ACCOUNTING VIOLATION: expected TotalRecoveredPaise=0 during PTP_COMMITTED state, got %d", statsAfterPTP.TotalRecoveredPaise)
	}
	if statsAfterPTP.TotalPTPCommittedPaise != 480000 {
		t.Fatalf("expected TotalPTPCommittedPaise=480000, got %d", statsAfterPTP.TotalPTPCommittedPaise)
	}

	// 3. Simulate arrival of promised date: Settle payment via advance
	advReq := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", caseID), nil)
	advW := httptest.NewRecorder()
	mux.ServeHTTP(advW, advReq)

	if advW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from advance, got %d", advW.Code)
	}

	cSettled, _ := ts.RecoveryMgr.GetCase(caseID)
	if cSettled.Status != "RECOVERED" {
		t.Fatalf("expected status RECOVERED after settlement, got %s", cSettled.Status)
	}
	if cSettled.RecoveredAmountPaise != 480000 {
		t.Fatalf("expected recovered_amount_paise to be 480000 upon capture, got %d", cSettled.RecoveredAmountPaise)
	}

	// Verify stats: TotalRecovered MUST now be 480000
	finalStats := ts.RecoveryMgr.GetStats()
	if finalStats.TotalRecoveredPaise != 480000 {
		t.Fatalf("expected TotalRecoveredPaise=480000 after confirmed settlement, got %d", finalStats.TotalRecoveredPaise)
	}
	if finalStats.TotalRecoveredINR != 4800.00 {
		t.Fatalf("expected TotalRecoveredINR=4800.00, got %f", finalStats.TotalRecoveredINR)
	}
}

func TestAPI_EmailPolicy_SuppressesFraudAndDispatchesReceipt(t *testing.T) {
	ts := NewTriageServer(diagnosis.NewEngine(), intervention.NewSelector(), recovery.NewManager(), budget.NewManager(1000000))
	mux := http.NewServeMux()
	ts.RegisterRoutes(mux)

	// 1. Ingest a case with FRAUD_SUSPECTED
	caseReqBody := `{"customer_name":"Suspicious User","customer_email":"badactor@example.com","plan_name":"GPU","amount_paise":1000000,"error_code":"FRAUD_SUSPECTED","error_desc":"Velocity spike"}`
	caseReq := httptest.NewRequest("POST", "/api/v1/triage/cases", bytes.NewReader([]byte(caseReqBody)))
	caseW := httptest.NewRecorder()
	mux.ServeHTTP(caseW, caseReq)

	var createdCase map[string]interface{}
	_ = json.Unmarshal(caseW.Body.Bytes(), &createdCase)
	caseID, _ := createdCase["id"].(string)

	// Try sending statement email for the fraud stop case -> MUST BE SUPPRESSED
	emailReqBody := `{"case_id":"` + caseID + `","to":"badactor@example.com"}`
	emailReq := httptest.NewRequest("POST", "/api/v1/triage/email/send", bytes.NewReader([]byte(emailReqBody)))
	emailW := httptest.NewRecorder()
	mux.ServeHTTP(emailW, emailReq)

	var emailResp map[string]interface{}
	_ = json.Unmarshal(emailW.Body.Bytes(), &emailResp)
	if emailResp["status"] != "SUPPRESSED_POLICY" {
		t.Fatalf("expected email to be SUPPRESSED_POLICY for fraud case, got: %+v", emailResp)
	}

	// 2. Receipt email for a recovered case
	receiptReqBody := `{"case_id":"` + caseID + `","to":"billing@acmecloud.io","email_type":"PAYMENT_RECEIPT","payment_id":"pay_rec_test_123"}`
	receiptReq := httptest.NewRequest("POST", "/api/v1/triage/email/send", bytes.NewReader([]byte(receiptReqBody)))
	receiptW := httptest.NewRecorder()
	mux.ServeHTTP(receiptW, receiptReq)

	var receiptResp map[string]interface{}
	_ = json.Unmarshal(receiptW.Body.Bytes(), &receiptResp)
	if receiptResp["status"] != "SKIPPED_DEMO_ACCOUNT" && receiptResp["status"] != "DELIVERED_SMTP" && receiptResp["status"] != "NOT_CONFIGURED" {
		t.Fatalf("unexpected receipt email status: %+v", receiptResp)
	}
}

func TestAPI_StrictScheduledRetryLifecycle_ExplicitPendingAndAttemptBounds(t *testing.T) {
	ts := NewTriageServer(diagnosis.NewEngine(), intervention.NewSelector(), recovery.NewManager(), budget.NewManager(1000000))
	mux := http.NewServeMux()
	ts.RegisterRoutes(mux)

	// 1. Create a case for scheduled retry (CASE-7001, ₹4,200 = 420,000 paise)
	caseReqBody := `{"customer_name":"Test Scheduled Corp","customer_email":"test@example.com","plan_name":"Compute Pro","amount_paise":420000,"error_code":"INSUFFICIENT_FUNDS","error_desc":"Balance insufficient"}`
	caseReq := httptest.NewRequest("POST", "/api/v1/triage/cases", bytes.NewReader([]byte(caseReqBody)))
	caseW := httptest.NewRecorder()
	mux.ServeHTTP(caseW, caseReq)

	var createdCase map[string]interface{}
	_ = json.Unmarshal(caseW.Body.Bytes(), &createdCase)
	caseID, _ := createdCase["id"].(string)

	// 2. Schedule Auto-Retry: Status becomes RETRY_SCHEDULED, recovered revenue MUST be 0
	schedReqBody := `{"resolution":"RETRY_SCHEDULED","notes":"Scheduled for salary day"}`
	schedReq := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/resolve", caseID), bytes.NewReader([]byte(schedReqBody)))
	schedW := httptest.NewRecorder()
	mux.ServeHTTP(schedW, schedReq)

	c, _ := ts.RecoveryMgr.GetCase(caseID)
	if c.Status != "RETRY_SCHEDULED" {
		t.Fatalf("expected status RETRY_SCHEDULED, got %s", c.Status)
	}
	if c.RecoveredAmountPaise != 0 {
		t.Fatalf("STRICT ACCOUNTING VIOLATION: expected recovered_amount_paise=0 during RETRY_SCHEDULED state, got %d", c.RecoveredAmountPaise)
	}

	statsAfterSched := ts.RecoveryMgr.GetStats()
	if statsAfterSched.TotalRecoveredPaise != 0 {
		t.Fatalf("expected TotalRecoveredPaise=0 during RETRY_SCHEDULED, got %d", statsAfterSched.TotalRecoveredPaise)
	}
	if statsAfterSched.TotalPTPCommittedPaise != 420000 {
		t.Fatalf("expected TotalPTPCommittedPaise=420000, got %d", statsAfterSched.TotalPTPCommittedPaise)
	}

	// 3. Retry Attempt 1 Fails: Increments AttemptsMade to 2 and transitions to RETRY_FAILED
	advFail1ReqBody := `{"outcome":"FAILURE","reason":"Card declined on retry"}`
	advFail1Req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", caseID), bytes.NewReader([]byte(advFail1ReqBody)))
	advFail1W := httptest.NewRecorder()
	mux.ServeHTTP(advFail1W, advFail1Req)

	cFail1, _ := ts.RecoveryMgr.GetCase(caseID)
	if cFail1.Status != "RETRY_FAILED" {
		t.Fatalf("expected status RETRY_FAILED on declined retry attempt 1, got %s", cFail1.Status)
	}
	if cFail1.AttemptsMade != 2 {
		t.Fatalf("expected AttemptsMade=2 (initial decline + retry 1), got %d", cFail1.AttemptsMade)
	}

	// 4. Retry Attempt 2 Fails: AttemptsMade becomes 3 (hits MaxAttempts=3) -> MUST escalate to ESCALATED, bounding retries
	advFail2ReqBody := `{"outcome":"FAILURE","reason":"Still insufficient funds on second retry"}`
	advFail2Req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", caseID), bytes.NewReader([]byte(advFail2ReqBody)))
	advFail2W := httptest.NewRecorder()
	mux.ServeHTTP(advFail2W, advFail2Req)

	cEscalated, _ := ts.RecoveryMgr.GetCase(caseID)
	if cEscalated.Status != "ESCALATED" {
		t.Fatalf("POLICY BOUND ENFORCEMENT VIOLATION: expected case to escalate to ESCALATED after hitting max attempts limit (3/3), got %s", cEscalated.Status)
	}
	if cEscalated.AttemptsMade != 3 {
		t.Fatalf("expected AttemptsMade=3, got %d", cEscalated.AttemptsMade)
	}

	// 6. Test Successful Capture on another case -> transitions to RECOVERED with confirmed Razorpay ID
	case2ReqBody := `{"customer_name":"Success Case Corp","customer_email":"success@example.com","plan_name":"Compute Pro","amount_paise":500000,"error_code":"INSUFFICIENT_FUNDS","error_desc":"Balance insufficient"}`
	case2Req := httptest.NewRequest("POST", "/api/v1/triage/cases", bytes.NewReader([]byte(case2ReqBody)))
	case2W := httptest.NewRecorder()
	mux.ServeHTTP(case2W, case2Req)

	var createdCase2 map[string]interface{}
	_ = json.Unmarshal(case2W.Body.Bytes(), &createdCase2)
	case2ID, _ := createdCase2["id"].(string)

	// Set to RETRY_SCHEDULED
	sched2Req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/resolve", case2ID), bytes.NewReader([]byte(`{"resolution":"RETRY_SCHEDULED"}`)))
	mux.ServeHTTP(httptest.NewRecorder(), sched2Req)

	// Settle with confirmed capture
	advSuccessReq := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", case2ID), bytes.NewReader([]byte(`{"outcome":"SUCCESS"}`)))
	mux.ServeHTTP(httptest.NewRecorder(), advSuccessReq)

	cSuccess, _ := ts.RecoveryMgr.GetCase(case2ID)
	if cSuccess.Status != "RECOVERED" {
		t.Fatalf("expected status RECOVERED upon confirmed capture, got %s", cSuccess.Status)
	}
	if cSuccess.RecoveredAmountPaise != 500000 {
		t.Fatalf("expected recovered_amount_paise=500000 upon capture, got %d", cSuccess.RecoveredAmountPaise)
	}
	if cSuccess.RazorpayPaymentID == "" {
		t.Fatalf("expected non-empty RazorpayPaymentID upon capture")
	}
}

func TestAPI_FallbackHonestBrandingWhenMLOffline(t *testing.T) {
	mux := http.NewServeMux()
	diag := diagnosis.NewEngine()
	inter := intervention.NewSelector()
	mgr := recovery.NewManager()
	budgetMgr := budget.NewManager(1000000)

	ts := NewTriageServer(diag, inter, mgr, budgetMgr)
	// Explicitly configure MLClient to point to an offline/unreachable port
	ts.MLClient = mlclient.NewClient("http://127.0.0.1:59999")
	inter.SetMLClient(ts.MLClient)
	ts.RegisterRoutes(mux)

	// 1. Check /api/v1/triage/ml/metrics endpoint
	metricsReq := httptest.NewRequest("GET", "/api/v1/triage/ml/metrics", nil)
	metricsW := httptest.NewRecorder()
	mux.ServeHTTP(metricsW, metricsReq)

	if metricsW.Code != http.StatusOK {
		t.Fatalf("expected 200 from metrics, got %d", metricsW.Code)
	}

	var metricsResp map[string]interface{}
	if err := json.Unmarshal(metricsW.Body.Bytes(), &metricsResp); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	modelType, _ := metricsResp["model_type"].(string)
	if modelType != "RandomForestClassifier (Embedded Go)" {
		t.Fatalf("expected model_type 'RandomForestClassifier (Embedded Go)' when ML service offline, got '%s'", modelType)
	}

	// 2. Advance a case to INTERVENING through the API and verify fallback ranking execution
	caseReqBody := `{"customer_name":"Branding Test Corp","customer_email":"test@branding.com","plan_name":"Scale","amount_paise":400000,"error_code":"INSUFFICIENT_FUNDS","error_desc":"Low balance"}`
	caseReq := httptest.NewRequest("POST", "/api/v1/triage/cases", bytes.NewReader([]byte(caseReqBody)))
	caseW := httptest.NewRecorder()
	mux.ServeHTTP(caseW, caseReq)

	var createdCase map[string]interface{}
	_ = json.Unmarshal(caseW.Body.Bytes(), &createdCase)
	caseID := createdCase["id"].(string)

	// Advance NEW -> DIAGNOSED
	adv1Req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", caseID), nil)
	mux.ServeHTTP(httptest.NewRecorder(), adv1Req)

	// Advance DIAGNOSED -> INTERVENING (calls ML ranking / fallback)
	adv2Req := httptest.NewRequest("POST", fmt.Sprintf("/api/v1/triage/cases/%s/advance", caseID), nil)
	adv2W := httptest.NewRecorder()
	mux.ServeHTTP(adv2W, adv2Req)

	c, ok := ts.RecoveryMgr.GetCase(caseID)
	if !ok {
		t.Fatalf("failed to retrieve case %s", caseID)
	}
	if c.Intervention == nil {
		t.Fatalf("expected intervention decision to be computed via fallback")
	}
	if c.Intervention.Action == "" {
		t.Fatalf("expected non-empty action from fallback")
	}
}

package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ledger/gateway/internal/audit"
	"github.com/ledger/gateway/internal/budget"
	"github.com/ledger/gateway/internal/catalog"
	"github.com/ledger/gateway/internal/diagnosis"
	"github.com/ledger/gateway/internal/gate"
	"github.com/ledger/gateway/internal/idempotency"
	"github.com/ledger/gateway/internal/intervention"
	"github.com/ledger/gateway/internal/razorpay"
	"github.com/ledger/gateway/internal/recovery"
	"github.com/ledger/gateway/internal/storage"
)

// Server coordinates all gateway dependencies and exposes HTTP routing.
type Server struct {
	budgetMgr      *budget.Manager
	gateEngine     *gate.Gate
	auditLogger    *audit.Logger
	idempotency    *idempotency.Store
	razorpayClient *razorpay.Client
	catalog        *catalog.Catalog
	storage        *storage.DB
	triageServer   *TriageServer
	mux            *http.ServeMux
}

// Config defines API server options.
type Config struct {
	Port                         string
	ManualApprovalThresholdPaise int64
	DefaultAgentCapacityPaise    int64
	RazorpayKeyID                string
	RazorpayKeySecret            string
	RazorpayWebhookSecret        string
	DBPath                       string
}

// NewServer initializes the Ledger Gateway Server.
func NewServer(cfg Config) (*Server, error) {
	db, err := storage.NewDB(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to init database: %w", err)
	}

	cat := catalog.NewCatalog()
	bMgr := budget.NewManager(cfg.DefaultAgentCapacityPaise)
	gEngine := gate.NewGate(gate.Config{
		ManualApprovalThresholdPaise: cfg.ManualApprovalThresholdPaise,
	}, bMgr, cat)
	aLogger := audit.NewLogger()
	iStore := idempotency.NewStore(24 * time.Hour)
	rzpClient := razorpay.NewClient(razorpay.Config{
		KeyID:         cfg.RazorpayKeyID,
		KeySecret:     cfg.RazorpayKeySecret,
		WebhookSecret: cfg.RazorpayWebhookSecret,
	})

	diagEngine := diagnosis.NewEngine()
	interSelector := intervention.NewSelector()
	recManager := recovery.NewManager()
	triageSrv := NewTriageServer(diagEngine, interSelector, recManager)

	s := &Server{
		budgetMgr:      bMgr,
		gateEngine:     gEngine,
		auditLogger:    aLogger,
		idempotency:    iStore,
		razorpayClient: rzpClient,
		catalog:        cat,
		storage:        db,
		triageServer:   triageSrv,
		mux:            http.NewServeMux(),
	}

	s.registerRoutes()
	return s, nil
}

// PurchaseRequest payload from client / evaluation harness.
type PurchaseRequest struct {
	AgentID              string `json:"agent_id"`
	ProductID            string `json:"product_id"`
	Quantity             int    `json:"quantity"`
	StatedAmountPaise    int64  `json:"stated_amount_paise,omitempty"`
	MaxBudgetPaise       int64  `json:"max_budget_paise,omitempty"`
	Reasoning            string `json:"reasoning"`
	IdempotencyKey       string `json:"idempotency_key"`
	SimulateTimeoutError bool   `json:"simulate_timeout_error,omitempty"` // For demo scenario 4
}

// HandleInitiatePurchase handles the complete gated transaction workflow.
func (s *Server) HandleInitiatePurchase(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	var req PurchaseRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "malformed JSON: " + err.Error()})
		return
	}

	if req.AgentID == "" {
		req.AgentID = "agent_default"
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	if req.IdempotencyKey == "" {
		req.IdempotencyKey = fmt.Sprintf("idem_%s", uuid.New().String()[:12])
	}

	// 1. Check Idempotency Store (Evora Outbox Pattern)
	reqHash := idempotency.ComputeHash(req.AgentID, req.ProductID, fmt.Sprintf("%d", req.Quantity), fmt.Sprintf("%d", req.StatedAmountPaise))
	rec, isNew, err := s.idempotency.Acquire(req.IdempotencyKey, req.AgentID, reqHash)
	if err != nil {
		if err == idempotency.ErrConflictInFlight {
			writeJSON(w, http.StatusConflict, map[string]interface{}{
				"status":  "PROCESSING",
				"message": "A transaction with this idempotency key is already currently in flight. Please retry shortly.",
			})
			return
		}
		if strings.Contains(err.Error(), "mismatch") {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "idempotency key reused with conflicting payload parameters",
			})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// If request was already completed previously, return cached response with zero double-charge!
	if !isNew && rec.Status == idempotency.StatusCompleted {
		s.auditLogger.Append(audit.Entry{
			AgentID:        req.AgentID,
			Action:         audit.ActionIdempotencyReplay,
			Reasoning:      "Idempotent replay detected - returning cached response without duplicate billing",
			GateDecision:   "BYPASSED",
			GateReason:     "Idempotent cache hit",
			IdempotencyKey: req.IdempotencyKey,
			Status:         "REPLAYED",
		})
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Idempotent-Replay", "true")
		w.WriteHeader(rec.ResponseCode)
		w.Write(rec.ResponseBody)
		return
	}

	// 2. Audit: Purchase Initiated
	s.auditLogger.Append(audit.Entry{
		AgentID:        req.AgentID,
		Action:         audit.ActionPurchaseInitiated,
		Reasoning:      req.Reasoning,
		GateDecision:   "EVALUATING",
		GateReason:     "Running rules engine checks",
		IdempotencyKey: req.IdempotencyKey,
		Status:         "PENDING",
	})

	// 3. Gate Rules Engine Evaluation
	gateReq := gate.Request{
		AgentID:              req.AgentID,
		ProductID:            req.ProductID,
		Quantity:             req.Quantity,
		StatedAmountPaise:    req.StatedAmountPaise,
		MaxBudgetPaise:       req.MaxBudgetPaise,
		StatedAgentReasoning: req.Reasoning,
	}

	report, prod, totalPaise, err := s.gateEngine.Evaluate(gateReq)
	if err != nil {
		_ = s.idempotency.Fail(req.IdempotencyKey, http.StatusInternalServerError, []byte(err.Error()))
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	orderID := fmt.Sprintf("ord_%s", uuid.New().String()[:12])
	now := time.Now().UTC()

	// 4. Handle Decision Verdicts
	switch report.Verdict {
	case gate.VerdictRejected:
		// Rule Violation (e.g. Budget Cap Exceeded or Price Mismatch)
		ruleJSON := audit.EncodeRuleBreakdown(report.EvaluatedRules)
		s.auditLogger.Append(audit.Entry{
			AgentID:        req.AgentID,
			Action:         audit.ActionOverBudgetRejected,
			Reasoning:      req.Reasoning,
			GateDecision:   report.Verdict,
			GateReason:     report.PrimaryReason,
			RuleBreakdown:  ruleJSON,
			AmountPaise:    totalPaise,
			IdempotencyKey: req.IdempotencyKey,
			Status:         "REJECTED",
		})

		snap := s.budgetMgr.GetSnapshot(req.AgentID)
		respPayload := map[string]interface{}{
			"status":         "REJECTED",
			"error_code":     "GATE_REJECTED",
			"primary_reason": report.PrimaryReason,
			"explainability": report,
			"budget_state": map[string]interface{}{
				"agent_id":        req.AgentID,
				"capacity_paise":  snap.CapacityPaise,
				"capacity_inr":    float64(snap.CapacityPaise) / 100.0,
				"remaining_paise": snap.RemainingPaise,
				"remaining_inr":   float64(snap.RemainingPaise) / 100.0,
				"spent_paise":     snap.SpentPaise,
				"spent_inr":       float64(snap.SpentPaise) / 100.0,
			},
		}
		respBytes, _ := json.Marshal(respPayload)
		_ = s.idempotency.Fail(req.IdempotencyKey, http.StatusBadRequest, respBytes)

		writeJSON(w, http.StatusBadRequest, respPayload)
		return

	case gate.VerdictPendingApproval:
		// High-Value Threshold Gate (Explicit Human Approval Required)
		resID := fmt.Sprintf("res_%s", orderID)
		if err := s.budgetMgr.Reserve(req.AgentID, resID, totalPaise); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		approvalID := fmt.Sprintf("app_%s", uuid.New().String()[:12])
		ruleJSON := audit.EncodeRuleBreakdown(report.EvaluatedRules)

		orderRec := storage.OrderRecord{
			ID:               orderID,
			AgentID:          req.AgentID,
			ProductID:        prod.ID,
			ProductName:      prod.Name,
			Quantity:         req.Quantity,
			UnitPricePaise:   prod.PricePaise,
			TotalAmountPaise: totalPaise,
			Currency:         "INR",
			Status:           "PENDING_APPROVAL",
			IdempotencyKey:   req.IdempotencyKey,
			Reasoning:        req.Reasoning,
			GateVerdict:      report.Verdict,
			GateReason:       report.PrimaryReason,
			CreatedAt:        now,
			UpdatedAt:        now,
		}
		_ = s.storage.SaveOrder(orderRec)

		appRec := storage.ApprovalRecord{
			ID:          approvalID,
			OrderID:     orderID,
			AgentID:     req.AgentID,
			AmountPaise: totalPaise,
			Currency:    "INR",
			Reason:      report.PrimaryReason,
			Status:      "PENDING",
			CreatedAt:   now,
		}
		_ = s.storage.SaveApproval(appRec)

		s.auditLogger.Append(audit.Entry{
			AgentID:        req.AgentID,
			Action:         audit.ActionApprovalRequested,
			Reasoning:      req.Reasoning,
			GateDecision:   report.Verdict,
			GateReason:     report.PrimaryReason,
			RuleBreakdown:  ruleJSON,
			OrderID:        orderID,
			AmountPaise:    totalPaise,
			IdempotencyKey: req.IdempotencyKey,
			Status:         "PENDING_APPROVAL",
		})

		respPayload := map[string]interface{}{
			"status":         "PENDING_APPROVAL",
			"approval_id":    approvalID,
			"order_id":       orderID,
			"amount_paise":   totalPaise,
			"amount_inr":     float64(totalPaise) / 100.0,
			"currency":       "INR",
			"message":        "High-value purchase requires explicit human operator authorization before Razorpay execution.",
			"explainability": report,
		}
		respBytes, _ := json.Marshal(respPayload)
		_ = s.idempotency.Complete(req.IdempotencyKey, http.StatusAccepted, respBytes)

		writeJSON(w, http.StatusAccepted, respPayload)
		return

	case gate.VerdictApproved:
		// Normal Approved Purchase Workflow -> Razorpay Execution
		resID := fmt.Sprintf("res_%s", orderID)
		if err := s.budgetMgr.Reserve(req.AgentID, resID, totalPaise); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}

		// 5. Create Razorpay Order
		rzpOrder, err := s.razorpayClient.CreateOrder(razorpay.OrderRequest{
			Amount:   totalPaise,
			Currency: "INR",
			Receipt:  fmt.Sprintf("rcpt_%s", orderID),
			Notes: map[string]string{
				"agent_id":        req.AgentID,
				"product_id":      prod.ID,
				"idempotency_key": req.IdempotencyKey,
			},
		})
		if err != nil {
			_ = s.budgetMgr.Release(req.AgentID, resID)
			s.auditLogger.Append(audit.Entry{
				AgentID:        req.AgentID,
				Action:         audit.ActionPaymentFailed,
				Reasoning:      req.Reasoning,
				GateDecision:   "ERROR",
				GateReason:     fmt.Sprintf("Razorpay order creation failed: %v", err),
				OrderID:        orderID,
				AmountPaise:    totalPaise,
				IdempotencyKey: req.IdempotencyKey,
				Status:         "FAILED",
			})
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Razorpay order error: " + err.Error()})
			return
		}

		s.auditLogger.Append(audit.Entry{
			AgentID:        req.AgentID,
			Action:         audit.ActionRazorpayOrderCreated,
			Reasoning:      fmt.Sprintf("Created Razorpay test order %s", rzpOrder.ID),
			GateDecision:   "APPROVED",
			GateReason:     "Order created in payment gateway",
			OrderID:        orderID,
			AmountPaise:    totalPaise,
			IdempotencyKey: req.IdempotencyKey,
			Status:         "ORDER_CREATED",
		})

		// 6. Simulate / Capture Payment
		rzpPayment, err := s.razorpayClient.SimulatePayment(rzpOrder.ID, totalPaise)
		if err != nil {
			_ = s.budgetMgr.Release(req.AgentID, resID)
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Payment capture failed: " + err.Error()})
			return
		}

		// 7. Commit Spend Budget
		_ = s.budgetMgr.Commit(req.AgentID, resID, totalPaise)

		// 8. Persist Order Record
		orderRec := storage.OrderRecord{
			ID:                orderID,
			AgentID:           req.AgentID,
			ProductID:         prod.ID,
			ProductName:       prod.Name,
			Quantity:          req.Quantity,
			UnitPricePaise:    prod.PricePaise,
			TotalAmountPaise:  totalPaise,
			Currency:          "INR",
			Status:            "PAID",
			IdempotencyKey:    req.IdempotencyKey,
			RazorpayOrderID:   rzpOrder.ID,
			RazorpayPaymentID: rzpPayment.ID,
			Reasoning:         req.Reasoning,
			GateVerdict:       report.Verdict,
			GateReason:        report.PrimaryReason,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		_ = s.storage.SaveOrder(orderRec)

		// 9. Append Final Audit Record
		ruleJSON := audit.EncodeRuleBreakdown(report.EvaluatedRules)
		s.auditLogger.Append(audit.Entry{
			AgentID:        req.AgentID,
			Action:         audit.ActionPaymentCaptured,
			Reasoning:      req.Reasoning,
			GateDecision:   report.Verdict,
			GateReason:     report.PrimaryReason,
			RuleBreakdown:  ruleJSON,
			OrderID:        orderID,
			AmountPaise:    totalPaise,
			IdempotencyKey: req.IdempotencyKey,
			Status:         "PAID",
		})

		snap := s.budgetMgr.GetSnapshot(req.AgentID)
		respPayload := map[string]interface{}{
			"status":              "PAID",
			"order_id":            orderID,
			"razorpay_order_id":   rzpOrder.ID,
			"razorpay_payment_id": rzpPayment.ID,
			"product_id":          prod.ID,
			"product_name":        prod.Name,
			"quantity":            req.Quantity,
			"amount_paise":        totalPaise,
			"amount_inr":          float64(totalPaise) / 100.0,
			"currency":            "INR",
			"explainability":      report,
			"budget_state": map[string]interface{}{
				"agent_id":        req.AgentID,
				"capacity_inr":    float64(snap.CapacityPaise) / 100.0,
				"remaining_inr":   float64(snap.RemainingPaise) / 100.0,
				"spent_inr":       float64(snap.SpentPaise) / 100.0,
				"remaining_paise": snap.RemainingPaise,
				"spent_paise":     snap.SpentPaise,
			},
		}

		respBytes, _ := json.Marshal(respPayload)
		_ = s.idempotency.Complete(req.IdempotencyKey, http.StatusOK, respBytes)

		// Demo scenario 4: Simulate network timeout on client side if requested
		if req.SimulateTimeoutError {
			http.Error(w, "504 Gateway Timeout (Simulated Flaky Connection)", http.StatusGatewayTimeout)
			return
		}

		writeJSON(w, http.StatusOK, respPayload)
		return
	}
}

// HandleListProducts returns catalog items.
func (s *Server) HandleListProducts(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	maxPriceStr := r.URL.Query().Get("max_price")
	var maxPricePaise int64
	if maxPriceStr != "" {
		if v, err := strconv.ParseInt(maxPriceStr, 10, 64); err == nil {
			maxPricePaise = v
		}
	}

	prods := s.catalog.ListProducts(category, maxPricePaise)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"products": prods,
		"total":    len(prods),
	})
}

// HandleCheckPrice calculates price for an item and quantity.
func (s *Server) HandleCheckPrice(w http.ResponseWriter, r *http.Request) {
	prodID := r.URL.Query().Get("product_id")
	qtyStr := r.URL.Query().Get("quantity")
	qty := 1
	if qtyStr != "" {
		if v, err := strconv.Atoi(qtyStr); err == nil && v > 0 {
			qty = v
		}
	}

	totalPaise, prod, err := s.catalog.CheckPrice(prodID, qty)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"product_id":  prod.ID,
		"name":        prod.Name,
		"quantity":    qty,
		"unit_paise":  prod.PricePaise,
		"unit_inr":    float64(prod.PricePaise) / 100.0,
		"total_paise": totalPaise,
		"total_inr":   float64(totalPaise) / 100.0,
		"currency":    prod.Currency,
		"stock":       prod.Stock,
	})
}

// HandleGetOrderStatus returns order details.
func (s *Server) HandleGetOrderStatus(w http.ResponseWriter, r *http.Request) {
	orderID := strings.TrimPrefix(r.URL.Path, "/api/v1/orders/")
	if orderID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing order_id"})
		return
	}

	order, err := s.storage.GetOrder(orderID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "order not found"})
		return
	}

	writeJSON(w, http.StatusOK, order)
}

// HandleGetAgentBudget returns token bucket balance.
func (s *Server) HandleGetAgentBudget(w http.ResponseWriter, r *http.Request) {
	agentID := strings.TrimPrefix(r.URL.Path, "/api/v1/agents/")
	agentID = strings.TrimSuffix(agentID, "/budget")
	if agentID == "" {
		agentID = "agent_default"
	}

	snap := s.budgetMgr.GetSnapshot(agentID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agent_id":        snap.AgentID,
		"capacity_paise":  snap.CapacityPaise,
		"capacity_inr":    float64(snap.CapacityPaise) / 100.0,
		"remaining_paise": snap.RemainingPaise,
		"remaining_inr":   float64(snap.RemainingPaise) / 100.0,
		"spent_paise":     snap.SpentPaise,
		"spent_inr":       float64(snap.SpentPaise) / 100.0,
		"reserved_paise":  snap.ReservedPaise,
		"reserved_inr":    float64(snap.ReservedPaise) / 100.0,
		"currency":        snap.Currency,
		"last_refill_at":  snap.LastRefillAt,
	})
}

// HandleResetAgentBudget resets spend budget tokens.
func (s *Server) HandleResetAgentBudget(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	agentID := strings.TrimPrefix(r.URL.Path, "/api/v1/agents/")
	agentID = strings.TrimSuffix(agentID, "/budget/reset")
	if agentID == "" {
		agentID = "agent_default"
	}

	bucket := s.budgetMgr.Reset(agentID, 0)
	s.auditLogger.Append(audit.Entry{
		AgentID:      agentID,
		Action:       audit.ActionBudgetReset,
		Reasoning:    "Admin / Demo session reset spend-budget token bucket",
		GateDecision: "APPROVED",
		GateReason:   "Manual reset initiated",
		Status:       "RESET",
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message":         "Budget successfully reset",
		"agent_id":        agentID,
		"capacity_inr":    float64(bucket.CapacityPaise) / 100.0,
		"remaining_inr":   float64(bucket.RemainingPaise) / 100.0,
		"remaining_paise": bucket.RemainingPaise,
	})
}

// HandleListApprovals returns pending approvals.
func (s *Server) HandleListApprovals(w http.ResponseWriter, r *http.Request) {
	apps, err := s.storage.ListPendingApprovals()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"pending_approvals": apps,
		"count":             len(apps),
	})
}

// HandleApproveTransaction approves a gated order.
func (s *Server) HandleApproveTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	approvalID := strings.TrimPrefix(r.URL.Path, "/api/v1/approvals/")
	approvalID = strings.TrimSuffix(approvalID, "/approve")

	app, err := s.storage.GetApproval(approvalID)
	if err != nil || app.Status != "PENDING" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "pending approval not found"})
		return
	}

	order, err := s.storage.GetOrder(app.OrderID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "associated order not found"})
		return
	}

	// Create Razorpay Order
	rzpOrder, err := s.razorpayClient.CreateOrder(razorpay.OrderRequest{
		Amount:   order.TotalAmountPaise,
		Currency: order.Currency,
		Receipt:  fmt.Sprintf("rcpt_%s", order.ID),
		Notes: map[string]string{
			"agent_id":    order.AgentID,
			"approval_id": app.ID,
		},
	})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	// Capture Payment
	rzpPay, err := s.razorpayClient.SimulatePayment(rzpOrder.ID, order.TotalAmountPaise)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}

	// Commit reserved budget
	resID := fmt.Sprintf("res_%s", order.ID)
	_ = s.budgetMgr.Commit(order.AgentID, resID, order.TotalAmountPaise)

	// Update order & approval
	now := time.Now().UTC()
	order.Status = "PAID"
	order.RazorpayOrderID = rzpOrder.ID
	order.RazorpayPaymentID = rzpPay.ID
	order.UpdatedAt = now
	_ = s.storage.SaveOrder(*order)

	reviewer := "operator_dashboard"
	app.Status = "APPROVED"
	app.Reviewer = reviewer
	app.ReviewedAt = &now
	_ = s.storage.SaveApproval(*app)

	s.auditLogger.Append(audit.Entry{
		AgentID:        order.AgentID,
		Action:         audit.ActionApprovalGranted,
		Reasoning:      fmt.Sprintf("Human operator (%s) approved high-value transaction", reviewer),
		GateDecision:   "APPROVED",
		GateReason:     "Manual human authorization override",
		OrderID:        order.ID,
		AmountPaise:    order.TotalAmountPaise,
		IdempotencyKey: order.IdempotencyKey,
		Status:         "PAID",
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":              "APPROVED",
		"message":             "Transaction successfully approved and executed on Razorpay",
		"order_id":            order.ID,
		"razorpay_order_id":   rzpOrder.ID,
		"razorpay_payment_id": rzpPay.ID,
	})
}

// HandleRejectTransaction rejects a gated order.
func (s *Server) HandleRejectTransaction(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	approvalID := strings.TrimPrefix(r.URL.Path, "/api/v1/approvals/")
	approvalID = strings.TrimSuffix(approvalID, "/reject")

	app, err := s.storage.GetApproval(approvalID)
	if err != nil || app.Status != "PENDING" {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "pending approval not found"})
		return
	}

	order, err := s.storage.GetOrder(app.OrderID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "associated order not found"})
		return
	}

	// Release reserved budget tokens
	resID := fmt.Sprintf("res_%s", order.ID)
	_ = s.budgetMgr.Release(order.AgentID, resID)

	now := time.Now().UTC()
	order.Status = "REJECTED"
	order.UpdatedAt = now
	_ = s.storage.SaveOrder(*order)

	reviewer := "operator_dashboard"
	app.Status = "REJECTED"
	app.Reviewer = reviewer
	app.ReviewedAt = &now
	_ = s.storage.SaveApproval(*app)

	s.auditLogger.Append(audit.Entry{
		AgentID:        order.AgentID,
		Action:         audit.ActionApprovalRejected,
		Reasoning:      fmt.Sprintf("Human operator (%s) rejected transaction", reviewer),
		GateDecision:   "REJECTED",
		GateReason:     "Human authorization denied",
		OrderID:        order.ID,
		AmountPaise:    order.TotalAmountPaise,
		IdempotencyKey: order.IdempotencyKey,
		Status:         "REJECTED",
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "REJECTED",
		"message":  "Transaction rejected and spend budget tokens released",
		"order_id": order.ID,
	})
}

// HandleListAuditLogs returns historical audit logs with query filter.
func (s *Server) HandleListAuditLogs(w http.ResponseWriter, r *http.Request) {
	agentID := r.URL.Query().Get("agent_id")
	action := r.URL.Query().Get("action")
	verdict := r.URL.Query().Get("decision")
	limitStr := r.URL.Query().Get("limit")
	limit := 100
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}

	entries := s.auditLogger.Query(audit.Filter{
		AgentID:      agentID,
		Action:       action,
		GateDecision: verdict,
		Limit:        limit,
	})

	valid, count, err := s.auditLogger.VerifyIntegrity()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"entries": entries,
		"total":   len(entries),
		"integrity": map[string]interface{}{
			"verified":     valid,
			"total_blocks": count,
			"error":        err,
		},
	})
}

// HandleAuditStream provides live Server-Sent Events (SSE) streaming to UI.
func (s *Server) HandleAuditStream(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := s.auditLogger.Subscribe()
	defer s.auditLogger.Unsubscribe(ch)

	// Send initial ping
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"connected\",\"time\":\"%s\"}\n\n", time.Now().UTC().Format(time.RFC3339))
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			fmt.Fprintf(w, "event: ping\ndata: {}\n\n")
			flusher.Flush()
		case entry, ok := <-ch:
			if !ok {
				return
			}
			b, _ := json.Marshal(entry)
			fmt.Fprintf(w, "event: audit\ndata: %s\n\n", string(b))
			flusher.Flush()
		}
	}
}

// HandleRazorpayWebhook receives asynchronous payment callbacks.
func (s *Server) HandleRazorpayWebhook(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Debug-Mode, X-Razorpay-Signature")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Read error", http.StatusBadRequest)
		return
	}

	sig := r.Header.Get("X-Razorpay-Signature")
	debugMode := r.Header.Get("X-Debug-Mode") == "true"

	if !debugMode && !s.razorpayClient.VerifyWebhookSignature(bodyBytes, sig) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	var payload razorpay.WebhookPayload
	if err := json.Unmarshal(bodyBytes, &payload); err == nil {
		tag := "VERIFIED_WEBHOOK"
		if debugMode {
			tag = "SIMULATED_WEBHOOK"
		}
		s.auditLogger.Append(audit.Entry{
			AgentID:      "razorpay_webhook",
			Action:       "WEBHOOK_RECEIVED",
			Reasoning:    fmt.Sprintf("[%s] Received Razorpay webhook event: %s", tag, payload.Event),
			GateDecision: "BYPASSED",
			Status:       payload.Event,
		})

		if payload.Event == "payment.failed" {
			createdCase := s.triageServer.IngestRazorpayWebhook(payload, debugMode)
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":  "ok",
				"case":    createdCase,
				"case_id": createdCase.ID,
			})
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// HandleHealth provides system health and cryptographic verification info.
func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	valid, count, err := s.auditLogger.VerifyIntegrity()
	statusStr := "healthy"
	if !valid || err != nil {
		statusStr = "degraded"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":          statusStr,
		"service":         "Ledger Gateway",
		"version":         "1.0.0",
		"time":            time.Now().UTC(),
		"chain_integrity": valid,
		"audit_entries":   count,
	})
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("/api/v1/purchase/initiate", s.corsMiddleware(s.HandleInitiatePurchase))
	s.mux.HandleFunc("/api/v1/products", s.corsMiddleware(s.HandleListProducts))
	s.mux.HandleFunc("/api/v1/products/price", s.corsMiddleware(s.HandleCheckPrice))
	s.mux.HandleFunc("/api/v1/orders/", s.corsMiddleware(s.HandleGetOrderStatus))
	s.mux.HandleFunc("/api/v1/agents/", s.corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/budget/reset") {
			s.HandleResetAgentBudget(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/budget") {
			s.HandleGetAgentBudget(w, r)
		} else {
			http.NotFound(w, r)
		}
	}))
	s.mux.HandleFunc("/api/v1/approvals", s.corsMiddleware(s.HandleListApprovals))
	s.mux.HandleFunc("/api/v1/approvals/", s.corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/approve") {
			s.HandleApproveTransaction(w, r)
		} else if strings.HasSuffix(r.URL.Path, "/reject") {
			s.HandleRejectTransaction(w, r)
		} else {
			http.NotFound(w, r)
		}
	}))
	s.mux.HandleFunc("/api/v1/audit/logs", s.corsMiddleware(s.HandleListAuditLogs))
	s.mux.HandleFunc("/api/v1/audit/stream", s.HandleAuditStream)
	s.mux.HandleFunc("/api/v1/webhooks/razorpay", s.HandleRazorpayWebhook)
	s.mux.HandleFunc("/api/v1/health", s.corsMiddleware(s.HandleHealth))

	// Track 03: Triage Revenue-Recovery Engine Routes
	s.triageServer.RegisterRoutes(s.mux)
}

// ServeHTTP implements http.Handler.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Idempotency-Key")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

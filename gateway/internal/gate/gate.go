package gate

import (
	"fmt"
	"sync"
	"time"

	"github.com/ledger/gateway/internal/budget"
	"github.com/ledger/gateway/internal/catalog"
)

// Verdict constants for gating decisions.
const (
	VerdictApproved        = "APPROVED"
	VerdictPendingApproval = "PENDING_APPROVAL"
	VerdictRejected        = "REJECTED"
)

// Rule names for structured explainability.
const (
	RuleBudgetSpendLimit    = "RULE_BUDGET_SPEND_LIMIT"
	RuleHighValueThreshold  = "RULE_HIGH_VALUE_THRESHOLD"
	RuleCatalogVerification = "RULE_CATALOG_PRICE_INTEGRITY"
	RuleVelocityLimit       = "RULE_VELOCITY_LIMIT"
	RuleStockAvailability   = "RULE_STOCK_AVAILABILITY"
)

// RuleEvaluation represents the outcome of a single rule check.
type RuleEvaluation struct {
	RuleName         string                 `json:"rule_name"`
	Passed           bool                   `json:"passed"`
	RequiresApproval bool                   `json:"requires_approval"`
	Reason           string                 `json:"reason"`
	Metadata         map[string]interface{} `json:"metadata,omitempty"`
}

// ExplainabilityReport is the complete explainability output for every gateway decision.
type ExplainabilityReport struct {
	Verdict              string           `json:"verdict"`
	PrimaryReason        string           `json:"primary_reason"`
	StatedAgentReasoning string           `json:"stated_agent_reasoning"`
	EvaluatedRules       []RuleEvaluation `json:"evaluated_rules"`
	Timestamp            time.Time        `json:"timestamp"`
}

// Request holds all parameters evaluated by the Gate.
type Request struct {
	AgentID              string `json:"agent_id"`
	ProductID            string `json:"product_id"`
	Quantity             int    `json:"quantity"`
	StatedAmountPaise    int64  `json:"stated_amount_paise"`
	MaxBudgetPaise       int64  `json:"max_budget_paise"`
	StatedAgentReasoning string `json:"stated_agent_reasoning"`
	Currency             string `json:"currency"`
}

// Config defines threshold policies for the Gate.
type Config struct {
	ManualApprovalThresholdPaise int64 // Default: 500,000 (₹5,000.00)
	MaxVelocityPerMinute         int   // Default: 10 tx/min per agent
}

// Gate evaluates incoming purchase requests against financial, security, and catalog rules.
type Gate struct {
	cfg           Config
	budgetMgr     *budget.Manager
	catalog       *catalog.Catalog
	mu            sync.Mutex
	velocityStore map[string][]time.Time
}

// NewGate creates a new rules engine.
func NewGate(cfg Config, budgetMgr *budget.Manager, cat *catalog.Catalog) *Gate {
	if cfg.ManualApprovalThresholdPaise <= 0 {
		cfg.ManualApprovalThresholdPaise = 500000 // ₹5,000.00
	}
	if cfg.MaxVelocityPerMinute <= 0 {
		cfg.MaxVelocityPerMinute = 15
	}
	return &Gate{
		cfg:           cfg,
		budgetMgr:     budgetMgr,
		catalog:       cat,
		velocityStore: make(map[string][]time.Time),
	}
}

// Evaluate runs the comprehensive rule set and produces an ExplainabilityReport.
func (g *Gate) Evaluate(req Request) (ExplainabilityReport, catalog.Product, int64, error) {
	now := time.Now().UTC()
	report := ExplainabilityReport{
		Verdict:              VerdictApproved,
		StatedAgentReasoning: req.StatedAgentReasoning,
		EvaluatedRules:       make([]RuleEvaluation, 0),
		Timestamp:            now,
	}

	if req.Currency == "" {
		req.Currency = "INR"
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}

	// 1. Catalog & Price Integrity Check
	prod, err := g.catalog.GetProduct(req.ProductID)
	if err != nil {
		eval := RuleEvaluation{
			RuleName: RuleCatalogVerification,
			Passed:   false,
			Reason:   fmt.Sprintf("Product '%s' not found in merchant catalog", req.ProductID),
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictRejected
		report.PrimaryReason = eval.Reason
		return report, catalog.Product{}, 0, nil
	}

	actualTotalPaise := prod.PricePaise * int64(req.Quantity)

	// Price mismatch / tampering verification
	if req.StatedAmountPaise > 0 && req.StatedAmountPaise != actualTotalPaise {
		eval := RuleEvaluation{
			RuleName: RuleCatalogVerification,
			Passed:   false,
			Reason: fmt.Sprintf("Price mismatch: stated amount ₹%.2f does not match merchant catalog total ₹%.2f (%d x ₹%.2f)",
				float64(req.StatedAmountPaise)/100.0, float64(actualTotalPaise)/100.0, req.Quantity, float64(prod.PricePaise)/100.0),
			Metadata: map[string]interface{}{
				"stated_paise": req.StatedAmountPaise,
				"actual_paise": actualTotalPaise,
			},
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictRejected
		report.PrimaryReason = eval.Reason
		return report, prod, actualTotalPaise, nil
	}

	report.EvaluatedRules = append(report.EvaluatedRules, RuleEvaluation{
		RuleName: RuleCatalogVerification,
		Passed:   true,
		Reason: fmt.Sprintf("Product '%s' verified: %d x ₹%.2f = ₹%.2f",
			prod.Name, req.Quantity, float64(prod.PricePaise)/100.0, float64(actualTotalPaise)/100.0),
		Metadata: map[string]interface{}{
			"product_name": prod.Name,
			"unit_paise":   prod.PricePaise,
			"total_paise":  actualTotalPaise,
		},
	})

	// 2. Stock Availability Check
	if prod.Stock < req.Quantity {
		eval := RuleEvaluation{
			RuleName: RuleStockAvailability,
			Passed:   false,
			Reason:   fmt.Sprintf("Insufficient inventory: requested %d, in stock %d", req.Quantity, prod.Stock),
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictRejected
		report.PrimaryReason = eval.Reason
		return report, prod, actualTotalPaise, nil
	}

	report.EvaluatedRules = append(report.EvaluatedRules, RuleEvaluation{
		RuleName: RuleStockAvailability,
		Passed:   true,
		Reason:   fmt.Sprintf("Stock verified: requested %d, available %d", req.Quantity, prod.Stock),
	})

	// 3. Velocity / Rate Check
	if !g.checkVelocity(req.AgentID, now) {
		eval := RuleEvaluation{
			RuleName: RuleVelocityLimit,
			Passed:   false,
			Reason:   fmt.Sprintf("Velocity limit exceeded: agent exceeded %d purchases per minute", g.cfg.MaxVelocityPerMinute),
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictRejected
		report.PrimaryReason = eval.Reason
		return report, prod, actualTotalPaise, nil
	}

	report.EvaluatedRules = append(report.EvaluatedRules, RuleEvaluation{
		RuleName: RuleVelocityLimit,
		Passed:   true,
		Reason:   "Velocity check passed (below agent rate limit)",
	})

	// 4. Hard Spend Budget Token Bucket Check
	bucket := g.budgetMgr.GetSnapshot(req.AgentID)
	availablePaise := bucket.RemainingPaise - bucket.ReservedPaise
	if availablePaise < actualTotalPaise {
		eval := RuleEvaluation{
			RuleName: RuleBudgetSpendLimit,
			Passed:   false,
			Reason: fmt.Sprintf("Spend limit exceeded: purchase amount ₹%.2f exceeds available budget ₹%.2f (Agent capacity ₹%.2f, already spent ₹%.2f)",
				float64(actualTotalPaise)/100.0, float64(availablePaise)/100.0, float64(bucket.CapacityPaise)/100.0, float64(bucket.SpentPaise)/100.0),
			Metadata: map[string]interface{}{
				"required_paise":  actualTotalPaise,
				"available_paise": availablePaise,
				"capacity_paise":  bucket.CapacityPaise,
				"spent_paise":     bucket.SpentPaise,
			},
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictRejected
		report.PrimaryReason = eval.Reason
		return report, prod, actualTotalPaise, nil
	}

	report.EvaluatedRules = append(report.EvaluatedRules, RuleEvaluation{
		RuleName: RuleBudgetSpendLimit,
		Passed:   true,
		Reason: fmt.Sprintf("Budget check passed: purchase ₹%.2f <= available budget ₹%.2f (Spend cap ₹%.2f)",
			float64(actualTotalPaise)/100.0, float64(availablePaise)/100.0, float64(bucket.CapacityPaise)/100.0),
		Metadata: map[string]interface{}{
			"required_paise":  actualTotalPaise,
			"available_paise": availablePaise,
		},
	})

	// 5. High-Value Threshold Gate Check (Explicit Human-in-the-loop)
	if actualTotalPaise >= g.cfg.ManualApprovalThresholdPaise {
		eval := RuleEvaluation{
			RuleName:         RuleHighValueThreshold,
			Passed:           true,
			RequiresApproval: true,
			Reason: fmt.Sprintf("High-value transaction: amount ₹%.2f meets or exceeds manual approval threshold of ₹%.2f. Explicit approval required.",
				float64(actualTotalPaise)/100.0, float64(g.cfg.ManualApprovalThresholdPaise)/100.0),
			Metadata: map[string]interface{}{
				"amount_paise":    actualTotalPaise,
				"threshold_paise": g.cfg.ManualApprovalThresholdPaise,
			},
		}
		report.EvaluatedRules = append(report.EvaluatedRules, eval)
		report.Verdict = VerdictPendingApproval
		report.PrimaryReason = eval.Reason
		return report, prod, actualTotalPaise, nil
	}

	report.EvaluatedRules = append(report.EvaluatedRules, RuleEvaluation{
		RuleName:         RuleHighValueThreshold,
		Passed:           true,
		RequiresApproval: false,
		Reason: fmt.Sprintf("Automatic approval allowed: amount ₹%.2f is below manual threshold of ₹%.2f",
			float64(actualTotalPaise)/100.0, float64(g.cfg.ManualApprovalThresholdPaise)/100.0),
	})

	report.Verdict = VerdictApproved
	report.PrimaryReason = fmt.Sprintf("All rules passed. Autonomous execution approved for ₹%.2f (%s)",
		float64(actualTotalPaise)/100.0, prod.Name)
	return report, prod, actualTotalPaise, nil
}

func (g *Gate) checkVelocity(agentID string, now time.Time) bool {
	g.mu.Lock()
	defer g.mu.Unlock()

	cutoff := now.Add(-1 * time.Minute)
	history := g.velocityStore[agentID]

	var valid []time.Time
	for _, t := range history {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= g.cfg.MaxVelocityPerMinute {
		g.velocityStore[agentID] = valid
		return false
	}

	valid = append(valid, now)
	g.velocityStore[agentID] = valid
	return true
}

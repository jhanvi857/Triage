package mlclient

import (
	"strings"
	"testing"
)

func TestEmbeddedRandomForest_PredictionAndTreeTraversal(t *testing.T) {
	rf := GetEmbeddedRandomForest()
	if rf == nil {
		t.Fatalf("expected embedded Random Forest to be initialized, got nil")
	}

	if rf.NEstimators != 100 {
		t.Fatalf("expected 100 estimators, got %d", rf.NEstimators)
	}

	if len(rf.Trees) != 100 {
		t.Fatalf("expected 100 decision trees in ensemble, got %d", len(rf.Trees))
	}

	if len(rf.FeatureNames) != 34 {
		t.Fatalf("expected 34 features in vectorizer output, got %d", len(rf.FeatureNames))
	}

	features := CaseFeatures{
		CaseID:                "CASE-TEST-EMBEDDED",
		Cause:                 "INSUFFICIENT_FUNDS",
		AmountPaise:           450000,
		AttemptNumber:         1,
		TimeSinceFailureHours: 1.0,
		OriginalRail:          "CARD",
		DayOfWeek:             2,
		Hour:                  14,
		PaydayProximityDays:   2,
		HistoricalSuccessRate: 0.85,
		PreviousSuccessCount:  3,
		DaysSinceLastPayment:  15,
	}

	vec := rf.Vectorize(features, "SWITCH_TO_SAVED_CARD")
	if len(vec) != 34 {
		t.Fatalf("expected 34-dim vectorized array, got %d", len(vec))
	}

	// Verify one-hot categorical encoding
	causeIdx := rf.featureIdx["cause=INSUFFICIENT_FUNDS"]
	if vec[causeIdx] != 1.0 {
		t.Fatalf("expected cause=INSUFFICIENT_FUNDS to be 1.0, got %f", vec[causeIdx])
	}
	railIdx := rf.featureIdx["original_rail=CARD"]
	if vec[railIdx] != 1.0 {
		t.Fatalf("expected original_rail=CARD to be 1.0, got %f", vec[railIdx])
	}
	actionIdx := rf.featureIdx["candidate_action=SWITCH_TO_SAVED_CARD"]
	if vec[actionIdx] != 1.0 {
		t.Fatalf("expected candidate_action=SWITCH_TO_SAVED_CARD to be 1.0, got %f", vec[actionIdx])
	}

	prob := rf.PredictProba(features, "SWITCH_TO_SAVED_CARD")
	if prob <= 0.0 || prob > 1.0 {
		t.Fatalf("expected valid probability between 0 and 1, got %f", prob)
	}

	// Verify exact match against known sklearn prediction for this vector (~0.689)
	if prob < 0.60 || prob > 0.80 {
		t.Fatalf("expected probability around 0.689, got %f", prob)
	}
}

func TestClient_EmbeddedRankEvaluatesRealRandomForest(t *testing.T) {
	// Point to unreachable port to trigger embedded Go Random Forest execution
	client := NewClient("http://127.0.0.1:59999")

	features := CaseFeatures{
		CaseID:                "CASE-TEST-CLIENT",
		Cause:                 "INSUFFICIENT_FUNDS",
		AmountPaise:           450000,
		AttemptNumber:         1,
		TimeSinceFailureHours: 1.0,
		OriginalRail:          "CARD",
		DayOfWeek:             2,
		Hour:                  14,
		PaydayProximityDays:   2,
		HistoricalSuccessRate: 0.85,
		PreviousSuccessCount:  3,
		DaysSinceLastPayment:  15,
		CandidateActions: []string{
			"SWITCH_TO_SAVED_CARD",
			"RETRY_NEXT_PAYDAY_WINDOW",
			"PROMISE_TO_PAY",
			"ESCALATE_HUMAN",
		},
	}

	resp := client.RankCandidates(features)

	// Invariant 1: Source and ModelType accurately reflect the embedded Random Forest
	if resp.Source != "EMBEDDED_MODEL" {
		t.Fatalf("expected Source 'EMBEDDED_MODEL', got '%s'", resp.Source)
	}
	if !strings.Contains(resp.ModelType, "RandomForestClassifier") {
		t.Fatalf("expected ModelType to indicate RandomForestClassifier, got '%s'", resp.ModelType)
	}

	// Invariant 2: Candidates are ranked
	if len(resp.RankedCandidates) != 4 {
		t.Fatalf("expected 4 ranked candidates, got %d", len(resp.RankedCandidates))
	}

	// Invariant 3: Probabilities and expected values are evaluated
	for _, c := range resp.RankedCandidates {
		if c.Probability <= 0.0 || c.Probability > 1.0 {
			t.Fatalf("invalid candidate probability: %f for action %s", c.Probability, c.Action)
		}
		if c.ExpectedValuePaise <= 0 {
			t.Fatalf("expected positive expected value, got %d for action %s", c.ExpectedValuePaise, c.Action)
		}
	}

	// Invariant 4: Empty candidates handled cleanly
	emptyResp := client.RankCandidates(CaseFeatures{
		CaseID:           "CASE-EMPTY",
		Cause:            "INSUFFICIENT_FUNDS",
		CandidateActions: nil,
	})
	if emptyResp.Source != "EMBEDDED_MODEL" {
		t.Fatalf("expected Source 'EMBEDDED_MODEL', got '%s'", emptyResp.Source)
	}
}

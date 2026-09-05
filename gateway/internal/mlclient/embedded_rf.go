package mlclient

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"sync"
)

//go:embed rf_model.json
var defaultRFModelJSON []byte

// DecisionTree represents a single trained tree in the Random Forest ensemble
type DecisionTree struct {
	Left      []int     `json:"left"`
	Right     []int     `json:"right"`
	Feature   []int     `json:"feature"`
	Threshold []float64 `json:"threshold"`
	Value     []float64 `json:"value"` // class 1 (successful recovery) probability
}

// EmbeddedRandomForest is a pure Go inference engine for the exported sklearn RandomForestClassifier
type EmbeddedRandomForest struct {
	FeatureNames []string       `json:"feature_names"`
	NClasses     int            `json:"n_classes"`
	NEstimators  int            `json:"n_estimators"`
	Trees        []DecisionTree `json:"trees"`

	featureIdx map[string]int
}

var (
	globalEmbeddedRF *EmbeddedRandomForest
	globalRFOnce     sync.Once
)

// GetEmbeddedRandomForest returns the initialized embedded RF model
func GetEmbeddedRandomForest() *EmbeddedRandomForest {
	globalRFOnce.Do(func() {
		rf, err := LoadEmbeddedRandomForest(defaultRFModelJSON)
		if err != nil {
			log.Printf("[WARN] Failed to load embedded RF model: %v", err)
			return
		}
		globalEmbeddedRF = rf
	})
	return globalEmbeddedRF
}

// LoadEmbeddedRandomForest deserializes the JSON tree model
func LoadEmbeddedRandomForest(data []byte) (*EmbeddedRandomForest, error) {
	var rf EmbeddedRandomForest
	if err := json.Unmarshal(data, &rf); err != nil {
		return nil, err
	}
	rf.featureIdx = make(map[string]int, len(rf.FeatureNames))
	for i, name := range rf.FeatureNames {
		rf.featureIdx[name] = i
	}
	return &rf, nil
}

// Vectorize converts CaseFeatures and a candidate action into a 34-dimensional float vector
func (rf *EmbeddedRandomForest) Vectorize(f CaseFeatures, action string) []float64 {
	vec := make([]float64, len(rf.FeatureNames))

	setNum := func(key string, val float64) {
		if idx, ok := rf.featureIdx[key]; ok {
			vec[idx] = val
		}
	}
	setCat := func(key string, val string) {
		col := fmt.Sprintf("%s=%s", key, val)
		if idx, ok := rf.featureIdx[col]; ok {
			vec[idx] = 1.0
		}
	}

	// 9 Numerical / Temporal features
	setNum("amount_paise", float64(f.AmountPaise))
	setNum("attempt_number", float64(f.AttemptNumber))
	setNum("time_since_failure_hours", f.TimeSinceFailureHours)
	setNum("day_of_week", float64(f.DayOfWeek))
	setNum("hour", float64(f.Hour))
	setNum("payday_proximity_days", float64(f.PaydayProximityDays))
	setNum("historical_success_rate", f.HistoricalSuccessRate)
	setNum("previous_success_count", float64(f.PreviousSuccessCount))
	setNum("days_since_last_payment", float64(f.DaysSinceLastPayment))

	// 3 Categorical features (One-hot encoded)
	setCat("cause", f.Cause)
	setCat("original_rail", f.OriginalRail)
	setCat("candidate_action", action)

	return vec
}

// PredictProba evaluates all 100 decision trees in the forest and returns average probability
func (rf *EmbeddedRandomForest) PredictProba(f CaseFeatures, action string) float64 {
	if rf == nil || len(rf.Trees) == 0 {
		return 0.5
	}

	vec := rf.Vectorize(f, action)

	sum := 0.0
	for i := range rf.Trees {
		t := &rf.Trees[i]
		node := 0
		for t.Left[node] != -1 {
			fIdx := t.Feature[node]
			if vec[fIdx] <= t.Threshold[node] {
				node = t.Left[node]
			} else {
				node = t.Right[node]
			}
		}
		sum += t.Value[node]
	}

	return sum / float64(len(rf.Trees))
}

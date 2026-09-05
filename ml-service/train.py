#!/usr/bin/env python3
"""
Triage ML Ranking Service - Model Training & Evaluation Pipeline
Autonomous Machine-Learning Intervention Ranking across Bounded Recovery Actions

Principle:
  ML ranks bounded recovery choices. Context MUST actually matter.
  Interaction effects between: cause x action x context.
  Dataset split: 70% Train, 15% Validation, 15% Held-Out Test.
  Zero LLMs, zero generative AI.
"""

import json
import os
import sys
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction import DictVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    roc_auc_score,
    precision_score,
    recall_score,
    f1_score,
    accuracy_score,
    log_loss,
)
import joblib

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Seven root causes + Mandate Limit
CAUSES = [
    "BANK_DOWNTIME_TIMEOUT",
    "INSUFFICIENT_FUNDS",
    "EXPIRED_CARD",
    "OTP_DROP_OFF",
    "MANDATE_LIMIT",
    "MANDATE_REVOKED",
    "FRAUD_SUSPECTED",
    "NETWORK_DECLINE",
]

# Bounded candidate action taxonomy
ACTIONS_BY_CAUSE = {
    "BANK_DOWNTIME_TIMEOUT": [
        "RETRY_SAME_RAIL_COOLDOWN",
        "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL",
        "ESCALATE_HUMAN",
    ],
    "INSUFFICIENT_FUNDS": [
        "SWITCH_TO_SAVED_CARD",
        "INCENTIVE_DISCOUNT",
        "RETRY_NEXT_PAYDAY_WINDOW",
        "PROMISE_TO_PAY",
        "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL",
        "ESCALATE_HUMAN",
    ],
    "EXPIRED_CARD": [
        "UPDATE_PAYMENT_METHOD",
        "ESCALATE_HUMAN",
    ],
    "OTP_DROP_OFF": [
        "RESUME_CHECKOUT",
        "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL",
        "ESCALATE_HUMAN",
    ],
    "MANDATE_LIMIT": [
        "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL",
        "REQUEST_MANDATE_LIMIT_INCREASE",
        "ESCALATE_HUMAN",
    ],
    "MANDATE_REVOKED": [
        "REAUTHORIZE_MANDATE",
        "COLLECT_OUTSTANDING_PAYMENT",
        "ESCALATE_HUMAN",
    ],
    "FRAUD_SUSPECTED": [
        "STOP",
        "ESCALATE_HUMAN",
    ],
    "NETWORK_DECLINE": [
        "RETRY_SAME_RAIL_COOLDOWN",
        "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL",
        "ESCALATE_HUMAN",
    ],
    "UNKNOWN_ERROR": [
        "ESCALATE_HUMAN",
        "STOP",
    ],
}

RAILS = ["CARD", "UPI", "NACH_MANDATE", "NETBANKING"]


def calculate_ground_truth_prob(features: dict, action: str) -> float:
    """
    Computes ground-truth recovery probability including multi-variable context interactions.
    Simulates real-world payment rail telemetry and human/banking dynamics.
    """
    cause = features.get("cause", "UNKNOWN_ERROR")
    amount = features.get("amount_paise", 400000)
    attempt = features.get("attempt_number", 1)
    time_since_failure = features.get("time_since_failure_hours", 1.0)
    rail = features.get("original_rail", "CARD")
    hour = features.get("hour", 14)
    payday_prox = features.get("payday_proximity_days", 10)
    hist_rate = features.get("historical_success_rate", 0.7)

    # 1. Diminishing returns on repeated attempts
    if attempt >= 3:
        if action in ["STOP", "ESCALATE_HUMAN"]:
            return 0.25 if action == "ESCALATE_HUMAN" else 0.0
        return max(0.02, 0.12 - 0.03 * (attempt - 3))

    # 2. INSUFFICIENT_FUNDS interactions
    if cause == "INSUFFICIENT_FUNDS":
        if action == "SWITCH_TO_SAVED_CARD":
            if hist_rate >= 0.6:
                return min(0.88, 0.76 + 0.12 * (hist_rate - 0.5))
            return 0.70
        elif action in ["RETRY_NEXT_PAYDAY_WINDOW", "RETRY_LATER"]:
            if payday_prox <= 2:
                return min(0.92, 0.84 + 0.08 * (hist_rate - 0.5))
            elif payday_prox <= 5:
                return 0.62
            else:
                return 0.32
        elif action == "PROMISE_TO_PAY":
            if payday_prox >= 6:
                return min(0.82, 0.74 + 0.10 * (hist_rate - 0.5))
            elif payday_prox <= 2:
                return 0.20
            return 0.35
        elif action == "INCENTIVE_DISCOUNT":
            if payday_prox >= 6 and amount <= 600000:
                return min(0.80, 0.65 + 0.10 * (hist_rate - 0.5))
            return 0.40
        elif action == "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL":
            return 0.22
        elif action == "ESCALATE_HUMAN":
            if amount >= 1000000 or attempt >= 2:
                return 0.65
            return 0.20

    # 3. BANK_DOWNTIME_TIMEOUT interactions
    elif cause == "BANK_DOWNTIME_TIMEOUT":
        if action == "RETRY_SAME_RAIL_COOLDOWN":
            if time_since_failure <= 2.0 and attempt == 1:
                return 0.86
            elif time_since_failure <= 4.0:
                return 0.55
            else:
                return 0.25
        elif action in ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"]:
            if time_since_failure > 2.0 or attempt >= 2:
                return 0.80
            return 0.48
        elif action == "ESCALATE_HUMAN":
            if amount >= 1000000:
                return 0.70
            return 0.15

    # 4. EXPIRED_CARD interactions
    elif cause == "EXPIRED_CARD":
        if action == "UPDATE_PAYMENT_METHOD":
            if hist_rate >= 0.5:
                return min(0.90, 0.82 + 0.08 * hist_rate)
            return 0.75
        elif action in ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"]:
            return 0.60
        elif action == "ESCALATE_HUMAN":
            if amount >= 1000000:
                return 0.65
            return 0.20

    # 5. OTP_DROP_OFF interactions
    elif cause == "OTP_DROP_OFF":
        if action in ["RESUME_CHECKOUT", "RETRY_AUTHENTICATION"]:
            if 9 <= hour <= 20 and time_since_failure <= 1.0:
                return 0.88
            elif 9 <= hour <= 20:
                return 0.68
            else:
                return 0.40
        elif action in ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"]:
            return 0.75
        elif action == "ESCALATE_HUMAN":
            if amount >= 1000000:
                return 0.58
            return 0.15

    # 6. MANDATE_LIMIT interactions
    elif cause == "MANDATE_LIMIT":
        if action == "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL":
            # One-Time UPI is dominant: same-day, zero friction, mandate untouched for next cycle
            return 0.89
        elif action == "REQUEST_MANDATE_LIMIT_INCREASE":
            # Async background action: multi-day re-auth, lower immediate recovery rate
            return 0.35
        elif action == "ESCALATE_HUMAN":
            if amount >= 1500000:
                return 0.50
            return 0.20

    # 7. MANDATE_REVOKED interactions
    elif cause == "MANDATE_REVOKED":
        if action == "REAUTHORIZE_MANDATE":
            if amount <= 800000:
                return 0.74
            return 0.55
        elif action in ["COLLECT_OUTSTANDING_PAYMENT", "CORPORATE_INVOICE"]:
            if amount >= 500000:
                return 0.72
            return 0.60
        elif action in ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"]:
            if amount <= 800000:
                return 0.55
            return 0.35
        elif action == "INCENTIVE_DISCOUNT":
            if amount <= 500000:
                return 0.64
            return 0.38
        elif action == "ESCALATE_HUMAN":
            if amount >= 800000:
                return 0.75
            return 0.30

    # 8. FRAUD_SUSPECTED interactions
    elif cause == "FRAUD_SUSPECTED":
        if action == "ESCALATE_HUMAN":
            return 0.40
        elif action == "STOP":
            return 0.0
        return 0.0

    # 9. NETWORK_DECLINE interactions
    elif cause == "NETWORK_DECLINE":
        if action == "RETRY_SAME_RAIL_COOLDOWN":
            return 0.76
        elif action in ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL"]:
            return 0.68
        elif action == "ESCALATE_HUMAN":
            return 0.20

    # Default fallback
    if action == "ESCALATE_HUMAN":
        return 0.30
    return 0.20


def generate_synthetic_dataset(num_cases: int = 4000, seed: int = 42):
    """
    Generates a realistic synthetic dataset of payment failure instances.
    Each case has contextual features and evaluated candidate actions with binary outcomes.
    """
    np.random.seed(seed)
    data_rows = []
    case_records = []

    for i in range(num_cases):
        cause = np.random.choice(
            CAUSES,
            p=[0.22, 0.24, 0.15, 0.13, 0.08, 0.08, 0.04, 0.06]
        )

        # Contextual feature sampling
        if cause == "INSUFFICIENT_FUNDS":
            amount_paise = int(np.random.choice([150000, 250000, 380000, 450000, 750000, 1250000]))
            payday_prox = int(np.random.choice([0, 1, 2, 7, 12, 18, 22]))
        elif cause == "BANK_DOWNTIME_TIMEOUT":
            amount_paise = int(np.random.choice([200000, 360000, 480000, 650000, 1200000, 1800000]))
            payday_prox = int(np.random.randint(0, 25))
        elif cause == "MANDATE_LIMIT":
            amount_paise = int(np.random.choice([1600000, 1850000, 2200000, 2500000, 3200000]))
            payday_prox = int(np.random.randint(0, 25))
        elif cause == "MANDATE_REVOKED":
            amount_paise = int(np.random.choice([180000, 350000, 500000, 850000, 1250000, 2500000]))
            payday_prox = int(np.random.randint(0, 25))
        else:
            amount_paise = int(np.random.choice([120000, 240000, 360000, 420000, 600000, 950000]))
            payday_prox = int(np.random.randint(0, 25))

        attempt_number = int(np.random.choice([1, 2, 3], p=[0.65, 0.25, 0.10]))
        time_since_failure_hours = round(float(np.random.choice([0.25, 0.5, 1.5, 3.5, 6.0, 14.0, 26.0])), 2)
        rail = str(np.random.choice(RAILS, p=[0.45, 0.35, 0.12, 0.08]))
        day_of_week = int(np.random.randint(0, 7))
        hour_probs = np.array([
            0.01, 0.01, 0.01, 0.01, 0.01, 0.02,
            0.03, 0.05, 0.07, 0.08, 0.09, 0.09,
            0.08, 0.07, 0.08, 0.08, 0.07, 0.05,
            0.04, 0.03, 0.02, 0.02, 0.01, 0.01
        ], dtype=float)
        hour_probs = hour_probs / np.sum(hour_probs)
        hour = int(np.random.choice(range(24), p=hour_probs))
        hist_rate = round(float(np.random.uniform(0.35, 0.95)), 2)
        prev_success_count = int(np.random.randint(1, 15))
        days_since_last_payment = int(np.random.randint(5, 60))

        case_features = {
            "cause": cause,
            "amount_paise": amount_paise,
            "attempt_number": attempt_number,
            "time_since_failure_hours": time_since_failure_hours,
            "original_rail": rail,
            "day_of_week": day_of_week,
            "hour": hour,
            "payday_proximity_days": payday_prox,
            "historical_success_rate": hist_rate,
            "previous_success_count": prev_success_count,
            "days_since_last_payment": days_since_last_payment,
        }

        allowed_actions = ACTIONS_BY_CAUSE.get(cause, ["ESCALATE_HUMAN", "STOP"])

        case_record = {
            "case_id": f"CASE-{1000+i}",
            "features": case_features,
            "allowed_actions": allowed_actions,
            "ground_truth_probs": {},
            "action_outcomes": {},
            "static_baseline_action": allowed_actions[0],
        }

        for act in allowed_actions:
            prob = calculate_ground_truth_prob(case_features, act)
            outcome = 1 if np.random.uniform(0, 1) < prob else 0

            row = dict(case_features)
            row["candidate_action"] = act
            data_rows.append((row, outcome, prob))
            case_record["ground_truth_probs"][act] = prob
            case_record["action_outcomes"][act] = outcome

        case_records.append(case_record)

    return data_rows, case_records


def train_and_evaluate():
    print("=" * 70)
    print("TRIAGE ML RANKING SERVICE: Model Training & Benchmark Pipeline")
    print("=" * 70)

    num_total_cases = 5000
    print(f"[1/5] Generating {num_total_cases} synthetic payment failure cases with interaction effects...")
    data_rows, case_records = generate_synthetic_dataset(num_cases=num_total_cases, seed=42)

    total_samples = len(data_rows)
    print(f"      Total evaluated (case x action) rows: {total_samples}")

    # Case-level split to completely avoid data leakage across action permutations
    num_cases = len(case_records)
    n_train = int(num_cases * 0.70)
    n_val = int(num_cases * 0.15)
    n_test = num_cases - n_train - n_val

    train_cases = case_records[:n_train]
    val_cases = case_records[n_train:n_train + n_val]
    test_cases = case_records[n_train + n_val:]

    print(f"[2/5] Splitting Dataset into Non-Overlapping Partitions:")
    print(f"      - Training Set   : {len(train_cases)} cases ({n_train / num_cases * 100:.1f}%)")
    print(f"      - Validation Set : {len(val_cases)} cases ({n_val / num_cases * 100:.1f}%)")
    print(f"      - Held-Out Test  : {len(test_cases)} cases ({n_test / num_cases * 100:.1f}%)")

    # Flatten train, val, test using realistic stochastic Bernoulli outcomes
    def flatten_cases(cases):
        X_dict = []
        y = []
        for c in cases:
            for act in c["allowed_actions"]:
                row = dict(c["features"])
                row["candidate_action"] = act
                outcome = c["action_outcomes"][act]
                X_dict.append(row)
                y.append(outcome)
        return X_dict, np.array(y)

    X_train_dict, y_train = flatten_cases(train_cases)
    X_val_dict, y_val = flatten_cases(val_cases)
    X_test_dict, y_test = flatten_cases(test_cases)

    print(f"\n[3/5] Training Tabular RandomForestClassifier...")
    pipeline = Pipeline([
        ("vectorizer", DictVectorizer(sparse=False)),
        ("clf", RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            min_samples_split=4,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=1
        ))
    ])

    pipeline.fit(X_train_dict, y_train)

    # 4. Held-Out Test Evaluation
    print("\n[4/5] Evaluating Model Metrics on HELD-OUT TEST SET (Never seen in training)...")
    y_test_pred_proba = pipeline.predict_proba(X_test_dict)[:, 1]
    y_test_pred = (y_test_pred_proba >= 0.5).astype(int)

    roc_auc = roc_auc_score(y_test, y_test_pred_proba)
    precision = precision_score(y_test, y_test_pred, zero_division=0)
    recall = recall_score(y_test, y_test_pred, zero_division=0)
    f1 = f1_score(y_test, y_test_pred, zero_division=0)
    acc = accuracy_score(y_test, y_test_pred)
    loss = log_loss(y_test, y_test_pred_proba)

    print(f"      * ROC-AUC Score   : {roc_auc:.4f}")
    print(f"      * Precision       : {precision:.4f}")
    print(f"      * Recall          : {recall:.4f}")
    print(f"      * F1-Score        : {f1:.4f}")
    print(f"      * Accuracy        : {acc:.4f}")
    print(f"      * Log Loss        : {loss:.4f}")

    # 5. Comparative Revenue Recovery Benchmark on Held-Out Test Cases
    print("\n[5/5] Running Comparative Recovery Experiment on EXACT SAME Held-Out Test Cases...")
    total_revenue_at_risk_paise = 0
    baseline_recovered_paise = 0
    ml_recovered_paise = 0

    baseline_recovered_cases = 0
    ml_recovered_cases = 0
    total_test_cases = len(test_cases)

    action_selection_counts_baseline = {}
    action_selection_counts_ml = {}

    for c in test_cases:
        amt = c["features"]["amount_paise"]
        total_revenue_at_risk_paise += amt

        # A) STATIC BASELINE: Always select the first allowed action
        baseline_act = c["static_baseline_action"]
        baseline_prob = c["ground_truth_probs"][baseline_act]
        action_selection_counts_baseline[baseline_act] = action_selection_counts_baseline.get(baseline_act, 0) + 1

        # Baseline recovery simulation
        if np.random.uniform(0, 1) < baseline_prob:
            baseline_recovered_cases += 1
            # Subtract 5% discount if concession action
            disc = int(amt * 0.05) if "DISCOUNT" in baseline_act else 0
            baseline_recovered_paise += (amt - min(disc, 50000))

        # B) ML POLICY: Rank all allowed candidates by P(recover | x, a) * amount
        candidate_scores = []
        for act in c["allowed_actions"]:
            row = dict(c["features"])
            row["candidate_action"] = act
            p_pred = pipeline.predict_proba([row])[0, 1]
            ev = p_pred * float(amt)
            candidate_scores.append((act, p_pred, ev))

        # Select candidate with highest expected value
        candidate_scores.sort(key=lambda x: x[2], reverse=True)
        best_act, best_p, best_ev = candidate_scores[0]
        action_selection_counts_ml[best_act] = action_selection_counts_ml.get(best_act, 0) + 1

        # Ground truth recovery simulation for the ML-chosen action
        ml_true_prob = c["ground_truth_probs"][best_act]
        if np.random.uniform(0, 1) < ml_true_prob:
            ml_recovered_cases += 1
            disc = int(amt * 0.05) if "DISCOUNT" in best_act else 0
            ml_recovered_paise += (amt - min(disc, 50000))

    baseline_inr = baseline_recovered_paise / 100.0
    ml_inr = ml_recovered_paise / 100.0
    risk_inr = total_revenue_at_risk_paise / 100.0

    baseline_rate = (baseline_recovered_cases / total_test_cases) * 100.0
    ml_rate = (ml_recovered_cases / total_test_cases) * 100.0

    abs_uplift = ml_rate - baseline_rate
    rel_uplift = ((ml_inr - baseline_inr) / max(baseline_inr, 1)) * 100.0

    print("-" * 70)
    print(f"REVENUE AT RISK       : ₹{risk_inr:,.2f} ({total_test_cases} Test Cases)")
    print(f"STATIC BASELINE RECOVERED : ₹{baseline_inr:,.2f} (Rate: {baseline_rate:.1f}%)")
    print(f"ML RANKED RECOVERED       : ₹{ml_inr:,.2f} (Rate: {ml_rate:.1f}%)")
    print(f"ABSOLUTE UPLIFT       : +{abs_uplift:.2f} percentage points")
    print(f"RELATIVE UPLIFT       : +{rel_uplift:.2f}%")
    print("-" * 70)

    # Save artifacts
    os.makedirs("ml-service", exist_ok=True)
    model_path = os.path.join("ml-service", "model.joblib")
    metrics_path = os.path.join("ml-service", "metrics.json")

    joblib.dump(pipeline, model_path)
    print(f"[OK] Saved trained model to {model_path}")

    metrics_data = {
        "model_type": "RandomForestClassifier",
        "n_estimators": 100,
        "test_cases_evaluated": total_test_cases,
        "total_revenue_at_risk_inr": risk_inr,
        "baseline_recovered_inr": baseline_inr,
        "ml_recovered_inr": ml_inr,
        "baseline_recovery_rate_pct": round(baseline_rate, 2),
        "ml_recovery_rate_pct": round(ml_rate, 2),
        "absolute_uplift_pct_points": round(abs_uplift, 2),
        "relative_uplift_pct": round(rel_uplift, 2),
        "roc_auc": round(roc_auc, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "accuracy": round(acc, 4),
        "actions_by_cause": ACTIONS_BY_CAUSE,
        "action_selection_counts_ml": action_selection_counts_ml,
    }

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"[OK] Saved evaluation metrics to {metrics_path}")

    # Export pure Go embedded Random Forest tree structure
    go_rf_path = os.path.join("gateway", "internal", "mlclient", "rf_model.json")
    export_rf_for_go(pipeline, go_rf_path)

    return metrics_data


def export_rf_for_go(pipeline, output_path: str):
    """Exports trained scikit-learn RandomForestClassifier to JSON for pure Go embedded inference."""
    try:
        vec = pipeline.named_steps["vectorizer"]
        clf = pipeline.named_steps.get("clf") or pipeline.named_steps.get("rf")
        if clf is None:
            return
        feature_names = list(vec.get_feature_names_out())
        trees = []
        for dt in clf.estimators_:
            t = dt.tree_
            values = []
            for val in t.value:
                total = val[0][0] + val[0][1]
                p1 = val[0][1] / total if total > 0 else 0.0
                values.append(round(float(p1), 5))
            trees.append({
                "left": t.children_left.tolist(),
                "right": t.children_right.tolist(),
                "feature": t.feature.tolist(),
                "threshold": [round(float(th), 5) for th in t.threshold],
                "value": values,
            })
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({
                "feature_names": feature_names,
                "n_classes": 2,
                "n_estimators": len(trees),
                "trees": trees,
            }, f)
        print(f"[OK] Exported pure Go embedded Random Forest model ({len(trees)} trees, {len(feature_names)} features) to {output_path}")
    except Exception as e:
        print(f"[WARN] Failed to export Go embedded RF model: {e}")


if __name__ == "__main__":
    train_and_evaluate()


#!/usr/bin/env python3
"""
Triage ML Benchmark Suite — 3-Model + Baseline Comparative Evaluation
Compares Random Forest, XGBoost, LightGBM, and Logistic Regression on identical held-out test partitions.
Evaluates:
  1. Classification Quality: ROC-AUC, Precision, Recall, F1, Accuracy, Log Loss
  2. Inference Latency: p50, p95, p99 (ms)
  3. Economic Efficacy: Recovery Rate (%), Total INR Recovered, Uplift over Static Baseline
"""

import json
import os
import sys
import time
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
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

# Optional XGBoost & LightGBM imports with graceful fallback
try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from lightgbm import LGBMClassifier
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Import synthetic dataset generator from train.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from train import generate_synthetic_dataset, ACTIONS_BY_CAUSE, CAUSES


def benchmark_all_models(num_cases: int = 5000, seed: int = 42):
    print("=" * 75)
    print("TRIAGE ML BENCHMARK: Multi-Model Evaluation (RF vs XGBoost vs LightGBM vs Baseline)")
    print("=" * 75)

    print(f"\n[1/4] Generating {num_cases} synthetic payment failure cases...")
    data_rows, case_records = generate_synthetic_dataset(num_cases=num_cases, seed=seed)

    # Split dataset: 70% Train, 15% Val, 15% Held-Out Test
    num_cases_total = len(case_records)
    n_train = int(num_cases_total * 0.70)
    n_val = int(num_cases_total * 0.15)
    n_test = num_cases_total - n_train - n_val

    train_cases = case_records[:n_train]
    val_cases = case_records[n_train:n_train + n_val]
    test_cases = case_records[n_train + n_val:]

    print(f"      - Training Set   : {len(train_cases)} cases")
    print(f"      - Validation Set : {len(val_cases)} cases")
    print(f"      - Held-Out Test  : {len(test_cases)} cases")

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

    # Define model candidates
    models = {}

    # 1. Baseline Logistic Regression
    models["LogisticRegression"] = {
        "name": "Logistic Regression (Linear Baseline)",
        "pipeline": Pipeline([
            ("vectorizer", DictVectorizer(sparse=False)),
            ("clf", LogisticRegression(max_iter=1000, random_state=seed)),
        ]),
        "type": "Linear Classifier",
    }

    # 2. Tabular Random Forest
    models["RandomForest"] = {
        "name": "Random Forest Classifier",
        "pipeline": Pipeline([
            ("vectorizer", DictVectorizer(sparse=False)),
            ("clf", RandomForestClassifier(
                n_estimators=100,
                max_depth=8,
                min_samples_split=6,
                min_samples_leaf=3,
                random_state=seed,
                n_jobs=1
            )),
        ]),
        "type": "Ensemble (Bagging)",
    }

    # 3. XGBoost
    if HAS_XGB:
        models["XGBoost"] = {
            "name": "XGBoost Classifier",
            "pipeline": Pipeline([
                ("vectorizer", DictVectorizer(sparse=False)),
                ("clf", XGBClassifier(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.08,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    eval_metric="logloss",
                    random_state=seed,
                    n_jobs=1
                )),
            ]),
            "type": "Gradient Boosting (XGBoost)",
        }

    # 4. LightGBM
    if HAS_LGBM:
        models["LightGBM"] = {
            "name": "LightGBM Classifier",
            "pipeline": Pipeline([
                ("vectorizer", DictVectorizer(sparse=False)),
                ("clf", LGBMClassifier(
                    n_estimators=100,
                    max_depth=6,
                    learning_rate=0.08,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    random_state=seed,
                    verbose=-1,
                    n_jobs=1
                )),
            ]),
            "type": "Gradient Boosting (LightGBM)",
        }

    # Static Baseline Reference Metrics
    total_test_cases = len(test_cases)
    total_risk_paise = sum(c["features"]["amount_paise"] for c in test_cases)
    risk_inr = total_risk_paise / 100.0

    # Evaluate Static Baseline
    np.random.seed(seed)
    base_recovered_cases = 0
    base_recovered_paise = 0
    for c in test_cases:
        amt = c["features"]["amount_paise"]
        baseline_act = c["static_baseline_action"]
        baseline_prob = c["ground_truth_probs"][baseline_act]
        if np.random.uniform(0, 1) < baseline_prob:
            base_recovered_cases += 1
            disc = int(amt * 0.05) if "DISCOUNT" in baseline_act else 0
            base_recovered_paise += (amt - min(disc, 50000))

    baseline_inr = base_recovered_paise / 100.0
    baseline_case_rate = (base_recovered_cases / total_test_cases) * 100.0
    baseline_revenue_rate = (baseline_inr / risk_inr) * 100.0

    print(f"\n[2/4] Static Baseline Performance:")
    print(f"      - Total Revenue At Risk : ₹{risk_inr:,.2f} ({total_test_cases} cases)")
    print(f"      - Baseline Recovered    : ₹{baseline_inr:,.2f} ({baseline_revenue_rate:.2f}% Revenue | {baseline_case_rate:.2f}% Cases)")

    # Train and evaluate each model
    results = {}
    print(f"\n[3/4] Training and Benchmarking Candidate Models on Held-Out Test Set...")

    base_dir = os.path.dirname(os.path.abspath(__file__))

    for model_key, model_info in models.items():
        print(f"\n   -> Training {model_info['name']}...")
        pipe = model_info["pipeline"]
        t0 = time.perf_counter()
        pipe.fit(X_train_dict, y_train)
        train_time_ms = (time.perf_counter() - t0) * 1000.0

        # Latency benchmark (single sample inference)
        latencies = []
        for sample in X_test_dict[:100]:
            t_start = time.perf_counter()
            _ = pipe.predict_proba([sample])[0, 1]
            latencies.append((time.perf_counter() - t_start) * 1000.0)

        p50_latency = float(np.percentile(latencies, 50))
        p95_latency = float(np.percentile(latencies, 95))
        p99_latency = float(np.percentile(latencies, 99))

        # Classification Metrics on Held-Out Test Set
        y_pred_proba = pipe.predict_proba(X_test_dict)[:, 1]
        y_pred = (y_pred_proba >= 0.5).astype(int)

        roc_auc = float(roc_auc_score(y_test, y_pred_proba))
        precision = float(precision_score(y_test, y_pred, zero_division=0))
        recall = float(recall_score(y_test, y_pred, zero_division=0))
        f1 = float(f1_score(y_test, y_pred, zero_division=0))
        acc = float(accuracy_score(y_test, y_pred))
        loss = float(log_loss(y_test, y_pred_proba))

        # Economic Recovery Benchmark on Held-Out Cases
        np.random.seed(seed)
        model_rec_cases = 0
        model_rec_paise = 0
        action_counts = {}

        for c in test_cases:
            amt = c["features"]["amount_paise"]
            candidate_scores = []
            for act in c["allowed_actions"]:
                row = dict(c["features"])
                row["candidate_action"] = act
                p_pred = pipe.predict_proba([row])[0, 1]
                # EV = P(recover) * (Amount - Concession)
                disc_est = min(int(amt * 0.05), 50000) if "DISCOUNT" in act else 0
                ev = p_pred * float(amt - disc_est)
                candidate_scores.append((act, p_pred, ev))

            candidate_scores.sort(key=lambda x: x[2], reverse=True)
            best_act, best_p, best_ev = candidate_scores[0]
            action_counts[best_act] = action_counts.get(best_act, 0) + 1

            true_prob = c["ground_truth_probs"][best_act]
            if np.random.uniform(0, 1) < true_prob:
                model_rec_cases += 1
                disc = int(amt * 0.05) if "DISCOUNT" in best_act else 0
                model_rec_paise += (amt - min(disc, 50000))

        rec_case_rate = (model_rec_cases / total_test_cases) * 100.0
        rec_inr = model_rec_paise / 100.0
        rec_revenue_rate = (rec_inr / risk_inr) * 100.0

        abs_revenue_uplift = rec_revenue_rate - baseline_revenue_rate
        abs_case_uplift = rec_case_rate - baseline_case_rate
        rel_revenue_uplift = ((rec_inr - baseline_inr) / max(baseline_inr, 1)) * 100.0

        results[model_key] = {
            "model_key": model_key,
            "name": model_info["name"],
            "type": model_info["type"],
            "roc_auc": round(roc_auc, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "accuracy": round(acc, 4),
            "log_loss": round(loss, 4),
            "train_time_ms": round(train_time_ms, 2),
            "p50_latency_ms": round(p50_latency, 3),
            "p95_latency_ms": round(p95_latency, 3),
            "p99_latency_ms": round(p99_latency, 3),
            "recovered_inr": round(rec_inr, 2),
            "revenue_recovery_rate_pct": round(rec_revenue_rate, 2),
            "case_recovery_rate_pct": round(rec_case_rate, 2),
            "recovery_rate_pct": round(rec_revenue_rate, 2),
            "absolute_revenue_uplift_pp": round(abs_revenue_uplift, 2),
            "absolute_case_uplift_pp": round(abs_case_uplift, 2),
            "absolute_uplift_pct_points": round(abs_revenue_uplift, 2),
            "relative_uplift_pct": round(rel_revenue_uplift, 2),
            "action_distribution": action_counts,
        }

        print(f"      ROC-AUC: {roc_auc:.4f} | F1: {f1:.4f} | Revenue: ₹{rec_inr:,.2f} ({rec_revenue_rate:.2f}%, Uplift: +{abs_revenue_uplift:.2f}pp) | Cases: {rec_case_rate:.2f}% | p99: {p99_latency:.2f}ms")

    # Select production champion based on recovery uplift and latency reliability
    sorted_by_uplift = sorted(results.values(), key=lambda x: x["recovered_inr"], reverse=True)
    champion_key = sorted_by_uplift[0]["model_key"]

    prod_model_key = "RandomForest" if "RandomForest" in results else champion_key
    # Save the production model pipeline artifact
    os.makedirs(base_dir, exist_ok=True)
    prod_pipe = models["RandomForest"]["pipeline"]
    model_path = os.path.join(base_dir, "model.joblib")
    joblib.dump(prod_pipe, model_path)
    print(f"\n[OK] Saved production model (RandomForest) to {model_path}")

    # Determine benchmark leader vs production choice
    champion_key = max(results.keys(), key=lambda k: results[k]["recovered_inr"])
    prod_model_key = "RandomForest"

    diff_inr = results[champion_key]["recovered_inr"] - results[prod_model_key]["recovered_inr"]
    diff_pp = results[champion_key]["revenue_recovery_rate_pct"] - results[prod_model_key]["revenue_recovery_rate_pct"]

    # Build comprehensive benchmark report
    benchmark_report = {
        "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "test_cases_count": total_test_cases,
        "revenue_at_risk_inr": risk_inr,
        "static_baseline": {
            "name": "Static 1-Rule-Per-Cause Baseline",
            "recovered_inr": round(baseline_inr, 2),
            "revenue_recovery_rate_pct": round(baseline_revenue_rate, 2),
            "case_recovery_rate_pct": round(baseline_case_rate, 2),
            "recovery_rate_pct": round(baseline_revenue_rate, 2),
        },
        "models": results,
        "champion_model": champion_key,
        "production_selected_model": prod_model_key,
        "selection_rationale": (
            f"Production Engineering Trade-off: While {champion_key} achieves the highest raw benchmark recovery "
            f"({results[champion_key]['revenue_recovery_rate_pct']:.2f}% vs {results[prod_model_key]['revenue_recovery_rate_pct']:.2f}%, "
            f"+₹{diff_inr:,.2f} on this held-out partition), Random Forest is deliberately selected for production "
            f"deployment because it eliminates external C++ runtime dependencies, prevents native library version drift, "
            f"and provides transparent, deterministic bagging auditability in a regulated financial recovery workflow."
        ),
    }

    # Save benchmark json
    benchmark_path = os.path.join(base_dir, "model_benchmark.json")
    with open(benchmark_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_report, f, indent=2)
    print(f"[OK] Saved multi-model benchmark report to {benchmark_path}")

    # Also update metrics.json for gateway backward compatibility
    metrics_data = {
        "model_type": f"{prod_model_key} ({models[prod_model_key]['name']})",
        "n_estimators": 100,
        "test_cases_evaluated": total_test_cases,
        "total_revenue_at_risk_inr": risk_inr,
        "baseline_recovered_inr": baseline_inr,
        "ml_recovered_inr": results[prod_model_key]["recovered_inr"],
        "baseline_revenue_recovery_rate_pct": round(baseline_revenue_rate, 2),
        "baseline_case_recovery_rate_pct": round(baseline_case_rate, 2),
        "baseline_recovery_rate_pct": round(baseline_revenue_rate, 2),
        "ml_revenue_recovery_rate_pct": results[prod_model_key]["revenue_recovery_rate_pct"],
        "ml_case_recovery_rate_pct": results[prod_model_key]["case_recovery_rate_pct"],
        "ml_recovery_rate_pct": results[prod_model_key]["revenue_recovery_rate_pct"],
        "absolute_revenue_uplift_pct_points": results[prod_model_key]["absolute_revenue_uplift_pp"],
        "absolute_case_uplift_pct_points": results[prod_model_key]["absolute_case_uplift_pp"],
        "absolute_uplift_pct_points": results[prod_model_key]["absolute_revenue_uplift_pp"],
        "relative_uplift_pct": results[prod_model_key]["relative_uplift_pct"],
        "roc_auc": results[prod_model_key]["roc_auc"],
        "precision": results[prod_model_key]["precision"],
        "recall": results[prod_model_key]["recall"],
        "f1_score": results[prod_model_key]["f1_score"],
        "accuracy": results[prod_model_key]["accuracy"],
        "p99_latency_ms": results[prod_model_key]["p99_latency_ms"],
        "actions_by_cause": ACTIONS_BY_CAUSE,
        "action_selection_counts_ml": results[prod_model_key]["action_distribution"],
    }
    metrics_path = os.path.join(base_dir, "metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"[OK] Updated {metrics_path}")

    # Print summary table
    print("\n" + "=" * 90)
    print(f"{'Model Name':<32} | {'ROC-AUC':<8} | {'F1-Score':<8} | {'Revenue Rec':<11} | {'Uplift (pp)':<11} | {'p99 Latency':<10}")
    print("-" * 90)
    print(f"{'Static Dunning Baseline':<32} | {'N/A':<8} | {'N/A':<8} | {baseline_revenue_rate:>9.2f}% | {'--':>11} | {'0.01ms':>10}")
    for k, v in results.items():
        marker = " [PROD]" if k == prod_model_key else ""
        name_str = f"{v['name']}{marker}"
        print(f"{name_str:<32} | {v['roc_auc']:>8.4f} | {v['f1_score']:>8.4f} | {v['revenue_recovery_rate_pct']:>9.2f}% | {v['absolute_revenue_uplift_pp']:>+10.2f}% | {v['p99_latency_ms']:>8.2f}ms")
    print("=" * 90)

    return benchmark_report


if __name__ == "__main__":
    benchmark_all_models()

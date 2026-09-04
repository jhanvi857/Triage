#!/usr/bin/env python3
"""
Triage ML Ranking Service - HTTP Inference & Telemetry Server
Exposes:
  - Random Forest / XGBoost / LightGBM Ranking & Scoring Engine
  - Multi-Model Offline Benchmark (/benchmark)
  - Continuous Retraining Feedback Loop (/retrain, /retrain/history)
  - Shadow Contextual Bandit Exploration Telemetry (Zero Execution Risk)
Zero LLMs, zero external APIs.
"""

import json
import os
import sys
import time
from flask import Flask, request, jsonify
import joblib

# Fix Windows console encoding
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shadow_bandit import shadow_bandit
from retrain import run_retraining_loop
from benchmark import benchmark_all_models

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "metrics.json")
BENCHMARK_PATH = os.path.join(BASE_DIR, "model_benchmark.json")
HISTORY_PATH = os.path.join(BASE_DIR, "retrain_history.json")

model = None
metrics_cache = {}
benchmark_cache = {}


def load_model():
    global model, metrics_cache, benchmark_cache
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"[ML SERVICE] Successfully loaded model from {MODEL_PATH}")
        except Exception as e:
            print(f"[ML SERVICE] Error loading model: {e}", file=sys.stderr)
    else:
        print(f"[ML SERVICE] Model file not found at {MODEL_PATH}. Run train.py first!", file=sys.stderr)

    if os.path.exists(METRICS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metrics_cache = json.load(f)
        except Exception as e:
            print(f"[ML SERVICE] Error loading metrics: {e}", file=sys.stderr)

    if os.path.exists(BENCHMARK_PATH):
        try:
            with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
                benchmark_cache = json.load(f)
        except Exception as e:
            print(f"[ML SERVICE] Error loading benchmark: {e}", file=sys.stderr)


load_model()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Triage ML Ranking Service",
        "model_loaded": model is not None,
        "model_type": metrics_cache.get("model_type", "RandomForestClassifier"),
        "shadow_bandit_active": True,
        "retrain_loop_active": True,
    })


@app.route("/metrics", methods=["GET"])
def get_metrics():
    if metrics_cache:
        return jsonify(metrics_cache)
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"error": "metrics not available"}), 404


@app.route("/benchmark", methods=["GET", "POST"])
def get_or_run_benchmark():
    """
    Returns the 3-model benchmark report (Random Forest vs XGBoost vs LightGBM vs Baseline).
    If POST, triggers a fresh benchmark run.
    """
    global benchmark_cache
    if request.method == "POST" or not os.path.exists(BENCHMARK_PATH):
        try:
            benchmark_cache = benchmark_all_models(num_cases=5000)
            load_model()
            return jsonify(benchmark_cache)
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    if benchmark_cache:
        return jsonify(benchmark_cache)

    if os.path.exists(BENCHMARK_PATH):
        with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
            benchmark_cache = json.load(f)
            return jsonify(benchmark_cache)

    return jsonify({"error": "benchmark not available"}), 404


@app.route("/retrain", methods=["POST"])
def retrain_model():
    """
    Triggers continuous retraining feedback loop with optional ingested live outcomes.
    Returns before/after evaluation delta on identical held-out test cases.
    """
    global model
    try:
        data = request.get_json(silent=True) or {}
        new_outcomes = data.get("outcomes", [])
        summary = run_retraining_loop(new_outcomes=new_outcomes)
        load_model()
        return jsonify(summary)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/retrain/history", methods=["GET"])
def get_retrain_history():
    """
    Returns the audit history of model retraining runs with before/after deltas.
    """
    if os.path.exists(HISTORY_PATH):
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify([])


@app.route("/score", methods=["POST"])
def score_candidate():
    """
    Scores a single candidate action given case features.
    """
    if model is None:
        return jsonify({"error": "ML model not initialized"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    candidate_action = data.get("candidate_action")
    if not candidate_action:
        return jsonify({"error": "candidate_action is required"}), 400

    amount_paise = int(data.get("amount_paise", data.get("amount", 100000)))

    row = {
        "cause": data.get("cause", "UNKNOWN_ERROR"),
        "amount_paise": amount_paise,
        "attempt_number": int(data.get("attempt_number", 1)),
        "time_since_failure_hours": float(data.get("time_since_failure_hours", 1.0)),
        "original_rail": data.get("original_rail", data.get("rail", "CARD")),
        "day_of_week": int(data.get("day_of_week", 2)),
        "hour": int(data.get("hour", 14)),
        "payday_proximity_days": int(data.get("payday_proximity_days", 10)),
        "historical_success_rate": float(data.get("historical_success_rate", 0.7)),
        "previous_success_count": int(data.get("previous_success_count", 5)),
        "days_since_last_payment": int(data.get("days_since_last_payment", 20)),
        "candidate_action": candidate_action,
    }

    try:
        prob = float(model.predict_proba([row])[0, 1])
        ev_paise = int(prob * float(amount_paise))

        return jsonify({
            "candidate_action": candidate_action,
            "probability": round(prob, 4),
            "probability_percent": round(prob * 100.0, 1),
            "expected_value_paise": ev_paise,
            "expected_value_inr": round(float(ev_paise) / 100.0, 2),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/rank", methods=["POST"])
def rank_candidates():
    """
    Ranks multiple allowed candidate actions for a case, calculates expected recovery values,
    and runs the Shadow Contextual Bandit exploration in parallel (observation only).
    """
    if model is None:
        return jsonify({"error": "ML model not initialized"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    candidates = data.get("candidate_actions", [])
    if not candidates:
        actions_map = {
            "BANK_DOWNTIME_TIMEOUT": ["RETRY_SAME_RAIL_COOLDOWN", "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL", "ESCALATE_HUMAN"],
            "INSUFFICIENT_FUNDS": ["SWITCH_TO_SAVED_CARD", "RETRY_NEXT_PAYDAY_WINDOW", "PROMISE_TO_PAY", "ESCALATE_HUMAN"],
            "EXPIRED_CARD": ["UPDATE_PAYMENT_METHOD", "ESCALATE_HUMAN"],
            "OTP_DROP_OFF": ["RESUME_CHECKOUT", "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL", "ESCALATE_HUMAN"],
            "MANDATE_LIMIT": ["SWITCH_TO_AVAILABLE_ALTERNATE_RAIL", "REQUEST_MANDATE_LIMIT_INCREASE", "ESCALATE_HUMAN"],
            "MANDATE_REVOKED": ["REAUTHORIZE_MANDATE", "COLLECT_OUTSTANDING_PAYMENT", "ESCALATE_HUMAN"],
            "FRAUD_SUSPECTED": ["STOP", "ESCALATE_HUMAN"],
            "NETWORK_DECLINE": ["RETRY_SAME_RAIL_COOLDOWN", "SWITCH_TO_AVAILABLE_ALTERNATE_RAIL", "ESCALATE_HUMAN"],
        }
        candidates = actions_map.get(cause, ["ESCALATE_HUMAN", "STOP"])

    amount_paise = int(data.get("amount_paise", data.get("amount", 100000)))

    ranked_list = []
    rows = []

    base_feature_dict = {
        "cause": data.get("cause", "UNKNOWN_ERROR"),
        "amount_paise": amount_paise,
        "attempt_number": int(data.get("attempt_number", 1)),
        "time_since_failure_hours": float(data.get("time_since_failure_hours", 1.0)),
        "original_rail": data.get("original_rail", data.get("rail", "CARD")),
        "day_of_week": int(data.get("day_of_week", 2)),
        "hour": int(data.get("hour", 14)),
        "payday_proximity_days": int(data.get("payday_proximity_days", 10)),
        "historical_success_rate": float(data.get("historical_success_rate", 0.7)),
        "previous_success_count": int(data.get("previous_success_count", 5)),
        "days_since_last_payment": int(data.get("days_since_last_payment", 20)),
    }

    for act in candidates:
        r = dict(base_feature_dict)
        r["candidate_action"] = act
        rows.append(r)

    try:
        probs = model.predict_proba(rows)[:, 1]
        for act, prob in zip(candidates, probs):
            p = float(prob)
            disc_est = min(int(amount_paise * 0.05), 50000) if "DISCOUNT" in act else 0
            ev = int(p * float(amount_paise - disc_est))

            reasoning = f"Predicted {p*100.0:.1f}% recovery probability based on contextual history & timing (EV: ₹{ev/100:.2f})"
            if act == "ESCALATE_HUMAN":
                reasoning = "Manual retention/risk specialist triage"
            elif act == "STOP":
                reasoning = "Cease automated recovery attempts"

            ranked_list.append({
                "action": act,
                "probability": round(p, 4),
                "probability_percent": round(p * 100.0, 1),
                "expected_value_paise": ev,
                "expected_value_inr": round(float(ev) / 100.0, 2),
                "reasoning": reasoning,
            })

        # Sort descending by Expected Value
        ranked_list.sort(key=lambda x: x["expected_value_paise"], reverse=True)
        selected = ranked_list[0] if ranked_list else None
        prod_action = selected["action"] if selected else "STOP"

        # Evaluate Shadow Contextual Bandit (Zero execution risk)
        case_id = data.get("case_id", "")
        bandit_report = shadow_bandit.evaluate_shadow_choice(
            case_id=case_id,
            features=base_feature_dict,
            candidate_scores=ranked_list,
            production_choice=prod_action,
        )

        return jsonify({
            "case_id": case_id,
            "cause": base_feature_dict["cause"],
            "amount_paise": amount_paise,
            "ranked_candidates": ranked_list,
            "selected_candidate": selected,
            "shadow_bandit": bandit_report,
            "model_type": metrics_cache.get("model_type", "RandomForestClassifier"),
            "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def main():
    port = int(os.environ.get("ML_PORT", 8000))
    print(f"============================================================")
    print(f"  TRIAGE ML RANKING SERVICE (RandomForestClassifier)")
    print(f"  Status: Active & Serving on http://0.0.0.0:{port}")
    print(f"  Multi-Model Benchmark | Shadow Bandit | Retrain Loop")
    print(f"  Zero LLMs | Pure Mathematical Optimization & Policy Gating")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()

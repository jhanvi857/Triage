#!/usr/bin/env python3
"""
Triage ML Ranking Service — HTTP Inference Server
Exposes Random Forest model for scoring and ranking bounded recovery candidates.
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

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "metrics.json")

model = None
metrics_cache = {}


def load_model():
    global model, metrics_cache
    if os.path.exists(MODEL_PATH):
        try:
            model = joblib.load(MODEL_PATH)
            print(f"[ML SERVICE] Successfully loaded Random Forest model from {MODEL_PATH}")
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


load_model()


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "Triage ML Ranking Service",
        "model_loaded": model is not None,
        "model_type": "RandomForestClassifier",
    })


@app.route("/metrics", methods=["GET"])
def get_metrics():
    if metrics_cache:
        return jsonify(metrics_cache)
    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"error": "metrics not available"}), 404


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
    Ranks multiple allowed candidate actions for a case and calculates expected recovery values.
    Returns ordered candidate recommendations.
    """
    if model is None:
        return jsonify({"error": "ML model not initialized"}), 503

    data = request.get_json(force=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    candidates = data.get("candidate_actions", [])
    if not candidates:
        # Default fallback candidate list based on cause
        cause = data.get("cause", "UNKNOWN_ERROR")
        actions_map = {
            "BANK_DOWNTIME_TIMEOUT": ["RETRY_SAME_RAIL_COOLDOWN", "SWITCH_RAIL_UPI", "ESCALATE_HUMAN"],
            "INSUFFICIENT_FUNDS": ["RETRY_LATER", "RETRY_NEXT_PAYDAY_WINDOW", "INCENTIVE_DISCOUNT", "ESCALATE_HUMAN"],
            "EXPIRED_CARD": ["SWITCH_RAIL_UPI", "CUSTOMER_PAYMENT_LINK", "ESCALATE_HUMAN"],
            "OTP_DROP_OFF": ["RETRY_AUTHENTICATION", "CUSTOMER_PAYMENT_LINK", "ESCALATE_HUMAN"],
            "MANDATE_REVOKED": ["INCENTIVE_DISCOUNT", "SWITCH_RAIL_UPI", "ESCALATE_HUMAN"],
            "FRAUD_SUSPECTED": ["ESCALATE_HUMAN", "STOP"],
            "NETWORK_DECLINE": ["RETRY_SAME_RAIL_COOLDOWN", "SWITCH_RAIL_UPI", "ESCALATE_HUMAN"],
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
            ev = int(p * float(amount_paise))

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

        return jsonify({
            "case_id": data.get("case_id", ""),
            "cause": base_feature_dict["cause"],
            "amount_paise": amount_paise,
            "ranked_candidates": ranked_list,
            "selected_candidate": selected,
            "model_type": "RandomForestClassifier",
            "evaluated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def main():
    port = int(os.environ.get("ML_PORT", 8000))
    print(f"============================================================")
    print(f"  TRIAGE ML RANKING SERVICE (RandomForestClassifier)")
    print(f"  Status: Active & Serving on http://0.0.0.0:{port}")
    print(f"  Zero LLMs | Pure ML Ranking & Expected Value Optimization")
    print(f"============================================================")
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()

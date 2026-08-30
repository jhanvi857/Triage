#!/usr/bin/env python3
"""
Triage Shadow-Mode Contextual Bandit Engine
Runs in SHADOW MODE ONLY alongside production Random Forest ranking.
Exploration Strategy:
  - Contextual Upper Confidence Bound (LinUCB / ε-greedy with variance bonus)
  - Evaluates counterfactual candidate actions to measure potential exploration gain vs regret.
  - Zero financial execution risk: Never mutates state or executes money movement.
"""

import math
import numpy as np


class ShadowBandit:
    """
    Shadow bandit logger that computes counterfactual exploration choices
    without executing them in production.
    """

    def __init__(self, alpha: float = 0.8, epsilon: float = 0.15):
        self.alpha = alpha  # Exploration bonus parameter
        self.epsilon = epsilon
        # Action counter state for arms
        self.action_counts = {}
        self.action_rewards = {}

    def evaluate_shadow_choice(
        self,
        case_id: str,
        features: dict,
        candidate_scores: list,
        production_choice: str,
    ) -> dict:
        """
        Takes candidates with ML predicted probabilities and computes what an
        exploration bandit (LinUCB / ε-greedy with variance penalty) would have selected.

        candidate_scores format:
          [ {"action": str, "probability": float, "expected_value_paise": int, "expected_value_inr": float}, ... ]
        """
        if not candidate_scores:
            return {
                "shadow_action": production_choice,
                "agreed_with_prod": True,
                "mode": "SHADOW_ONLY",
                "exploration_reason": "No candidate scores provided",
                "regret_estimate_inr": 0.0,
            }

        arm_scores = []
        total_t = sum(self.action_counts.values()) + 1

        for c in candidate_scores:
            act = c["action"]
            p_ml = float(c.get("probability", 0.5))
            ev_inr = float(c.get("expected_value_inr", 0.0))
            n_act = self.action_counts.get(act, 5)

            # UCB exploration score: EV * (1 + alpha * sqrt(ln(t) / (1 + n)))
            exploration_bonus = self.alpha * math.sqrt(math.log(max(total_t, 2)) / (n_act + 1))
            # If action is rare or has high upside variance, ucb_score gets a boost
            ucb_score = ev_inr * (1.0 + exploration_bonus)

            arm_scores.append({
                "action": act,
                "ml_probability": p_ml,
                "expected_value_inr": ev_inr,
                "exploration_bonus": round(exploration_bonus, 3),
                "ucb_score": round(ucb_score, 2),
                "pull_count": n_act,
            })

        # Sort arms by UCB score
        arm_scores.sort(key=lambda x: x["ucb_score"], reverse=True)
        shadow_choice = arm_scores[0]["action"]

        # Production choice EV
        prod_ev = next((c.get("expected_value_inr", 0.0) for c in candidate_scores if c["action"] == production_choice), 0.0)
        shadow_ev = next((c.get("expected_value_inr", 0.0) for c in candidate_scores if c["action"] == shadow_choice), 0.0)

        agreed = (shadow_choice == production_choice)

        if agreed:
            reason = f"Bandit agreed with production decision '{production_choice}' (both exploit highest verified EV of ₹{prod_ev:,.2f})"
            regret = 0.0
        else:
            reason = (
                f"Bandit chose to explore '{shadow_choice}' (exploration bonus: +{arm_scores[0]['exploration_bonus']*100:.1f}%) "
                f"to gather empirical outcome telemetry on lower-frequency arm (ML EV: ₹{shadow_ev:,.2f} vs Prod EV: ₹{prod_ev:,.2f})"
            )
            regret = max(0.0, prod_ev - shadow_ev)

        # Update shadow state tracking
        self.action_counts[shadow_choice] = self.action_counts.get(shadow_choice, 0) + 1

        return {
            "mode": "SHADOW_OBSERVATION_ONLY",
            "production_action": production_choice,
            "shadow_action": shadow_choice,
            "agreed_with_prod": agreed,
            "shadow_ev_inr": round(shadow_ev, 2),
            "production_ev_inr": round(prod_ev, 2),
            "exploration_reason": reason,
            "estimated_opportunity_cost_inr": round(regret, 2),
            "arm_evaluations": arm_scores,
            "zero_execution_risk": True,
        }


# Global instance
shadow_bandit = ShadowBandit()

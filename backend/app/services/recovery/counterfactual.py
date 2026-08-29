from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from backend.app.schemas.domain import (
    CounterfactualRequest,
    CounterfactualResponse,
    VariableDelta,
)
from backend.app.services.policy.engine import DeterministicPolicyEngine
from backend.app.services.recovery.engine import PLAYBOOKS


class CounterfactualService:
    """
    Pure Counterfactual Evaluation Engine.
    
    GUARANTEES:
    - Zero mutation of the original transaction records.
    - Deterministic evaluation of 'what-if' counterfactual parameters.
    - Explicit variable delta tracking & natural language explainability.
    """

    @staticmethod
    def evaluate(
        original_txn: Dict[str, Any],
        request: CounterfactualRequest,
    ) -> CounterfactualResponse:
        # Determine base action for given failure reason
        matching_playbook = next((p for p in PLAYBOOKS if p.reason == request.reason), None)
        default_action = matching_playbook.action if matching_playbook else "Retry payment"
        action = request.action_override if request.action_override else default_action

        # Evaluate Counterfactual State against Deterministic Policy Engine
        cf_eval = DeterministicPolicyEngine.evaluate(
            risk_score=request.risk_score,
            recovery_probability=request.recovery_probability,
            retry_count=request.retry_attempts,
            action=action,
            policy_threshold=request.policy_threshold,
        )

        orig_decision = original_txn.get("policy", "Approved")
        orig_result = original_txn.get("result", "Pending")
        cf_decision = cf_eval["decision"]
        cf_result = cf_eval["result"]

        outcome_flipped = orig_decision != cf_decision

        orig_amount = original_txn.get("amount_minor", 249900)
        orig_prob = original_txn.get("recovery_probability", 72)
        orig_ev = int((orig_amount * orig_prob) / 100) if orig_decision == "Approved" else 0
        cf_ev = int((request.amount_minor * request.recovery_probability) / 100) if cf_decision == "Approved" else 0
        ev_delta = cf_ev - orig_ev

        # Build Variable Deltas
        deltas: List[VariableDelta] = [
            VariableDelta(
                variable="Amount",
                original=f"₹{orig_amount // 100:,}",
                counterfactual=f"₹{request.amount_minor // 100:,}",
                changed=(orig_amount != request.amount_minor),
            ),
            VariableDelta(
                variable="Failure Reason",
                original=original_txn.get("reason", "Network degradation"),
                counterfactual=request.reason,
                changed=(original_txn.get("reason") != request.reason),
            ),
            VariableDelta(
                variable="Risk Score",
                original=str(original_txn.get("risk_score", 28)),
                counterfactual=str(request.risk_score),
                changed=(original_txn.get("risk_score") != request.risk_score),
            ),
            VariableDelta(
                variable="Recovery Probability",
                original=f"{original_txn.get('recovery_probability', 72)}%",
                counterfactual=f"{request.recovery_probability}%",
                changed=(original_txn.get("recovery_probability") != request.recovery_probability),
            ),
            VariableDelta(
                variable="Retry Attempts",
                original="1",
                counterfactual=str(request.retry_attempts),
                changed=(request.retry_attempts != 1),
            ),
            VariableDelta(
                variable="Policy Threshold",
                original="70",
                counterfactual=str(request.policy_threshold),
                changed=(request.policy_threshold != 70),
            ),
        ]

        # Generate Explainability Rationale
        if outcome_flipped:
            if cf_decision == "Escalated":
                explanation = (
                    f"Decision FLIPPED from APPROVED ➔ ESCALATED. "
                    f"Under modified conditions, {cf_eval['policy_reason']}"
                )
            else:
                explanation = (
                    f"Decision FLIPPED from ESCALATED ➔ APPROVED. "
                    f"Under modified conditions, risk and probability satisfied policy constraints: {cf_eval['policy_reason']}"
                )
        else:
            explanation = (
                f"Decision remained {cf_decision.upper()}. "
                f"{cf_eval['policy_reason']}"
            )

        return CounterfactualResponse(
            original_transaction_id=request.original_transaction_id,
            original_decision=orig_decision,
            counterfactual_decision=cf_decision,
            original_result=orig_result,
            counterfactual_result=cf_result,
            original_expected_value_minor=orig_ev,
            counterfactual_expected_value_minor=cf_ev,
            expected_value_delta_minor=ev_delta,
            outcome_flipped=outcome_flipped,
            deltas=deltas,
            explanation=explanation,
            simulated_at=datetime.now(timezone.utc),
        )

from typing import List
from backend.app.schemas.domain import (
    ActionCandidateEvaluation,
    StrategyOptimizationResponse,
    PolicyDecisionType,
)
from backend.app.services.policy.engine import DeterministicPolicyEngine
from backend.app.services.recovery.opportunity import OpportunityEngine


class StrategyOptimizer:
    """
    Evaluates candidate bounded recovery actions for a transaction,
    estimates expected recovery values against deterministic policy boundaries,
    and returns the best safe action.
    """

    CANDIDATE_ACTIONS = [
        "Retry payment",
        "Payment link",
        "Customer prompt",
        "Hinglish voice recovery",
        "Promise-to-pay tracker",
        "Escalate",
    ]

    @classmethod
    def optimize(
        cls,
        transaction_id: str,
        amount_minor: int,
        reason: str,
        base_risk_score: int,
        base_recovery_probability: int,
        retry_count: int = 1,
        policy_threshold: int = 70,
    ) -> StrategyOptimizationResponse:
        evaluations: List[ActionCandidateEvaluation] = []
        best_action = "Escalate"
        highest_safe_ev = 0

        for action in cls.CANDIDATE_ACTIONS:
            # Adjust risk and probability based on action characteristics
            adj_prob = base_recovery_probability
            adj_risk = base_risk_score

            if action == "Payment link":
                adj_prob = min(95, base_recovery_probability + 12)
                adj_risk = max(10, base_risk_score - 8)
            elif action == "Retry payment":
                if retry_count >= 2:
                    adj_prob = max(15, base_recovery_probability - 25)
                    adj_risk = min(90, base_risk_score + 35)
                else:
                    adj_prob = min(92, base_recovery_probability + 5)
                    adj_risk = base_risk_score
            elif action == "Customer prompt":
                adj_prob = min(88, base_recovery_probability + 2)
                adj_risk = max(15, base_risk_score - 5)
            elif action == "Hinglish voice recovery":
                adj_prob = min(85, base_recovery_probability + 4)
                adj_risk = max(20, base_risk_score - 2)
            elif action == "Promise-to-pay tracker":
                adj_prob = min(80, base_recovery_probability)
                adj_risk = max(25, base_risk_score + 5)
            elif action == "Escalate":
                adj_prob = 40
                adj_risk = base_risk_score

            # Deterministic Policy Gate check
            policy_res = DeterministicPolicyEngine.evaluate(
                risk_score=adj_risk,
                recovery_probability=adj_prob,
                retry_count=retry_count,
                action=action,
                policy_threshold=policy_threshold,
            )

            ev_minor = OpportunityEngine.calculate_expected_value_minor(amount_minor, adj_prob)

            decision: PolicyDecisionType = policy_res["decision"]
            execution_allowed: bool = policy_res["execution_allowed"]
            policy_reason: str = policy_res["policy_reason"]

            evaluations.append(
                ActionCandidateEvaluation(
                    action=action,
                    recovery_probability=adj_prob,
                    risk_score=adj_risk,
                    expected_value_minor=ev_minor,
                    policy_decision=decision,
                    execution_allowed=execution_allowed,
                    policy_reason=policy_reason,
                )
            )

            # Determine best safe action (must be policy approved)
            if execution_allowed and ev_minor > highest_safe_ev:
                highest_safe_ev = ev_minor
                best_action = action

        # If no action is policy approved, safe fallback is escalation
        if highest_safe_ev == 0:
            best_action = "Escalate"
            rationale = "No candidate action met all deterministic safety boundaries. Transaction escalated to human operator."
        else:
            rationale = f"Selected '{best_action}' providing highest expected recovery value (₹{highest_safe_ev / 100:,.2f}) within deterministic policy thresholds."

        return StrategyOptimizationResponse(
            transaction_id=transaction_id,
            amount_minor=amount_minor,
            best_safe_action=best_action,
            highest_expected_value_minor=highest_safe_ev,
            evaluations=evaluations,
            rationale=rationale,
        )

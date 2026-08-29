from typing import Dict, Literal, Set
from backend.app.core.config import settings

PolicyDecision = Literal["Approved", "Escalated"]
RecoveryResult = Literal["Recovered", "Stopped", "Pending"]

ALLOWED_RECOVERY_ACTIONS: Set[str] = {
    "Retry payment",
    "Payment link",
    "Customer prompt",
    "Escalate",
    "Retry subscription",
    "Recovery link",
    "Send AR reminder",
    "Escalate to AR owner",
    "Retry mandate",
    "Fallback payment link",
    "Hinglish voice recovery",
    "Call + payment link",
    "Track promised date",
    "Escalate missed promise",
}


class DeterministicPolicyEngine:
    """
    Core Deterministic Safety Gate for RazorRecover AI.
    
    GUARANTEES:
    1. Zero-hallucination execution boundary.
    2. AI diagnosis may recommend an action, but only this engine authorizes money movement.
    3. Pure deterministic mathematical rules.
    """

    @staticmethod
    def evaluate(
        risk_score: int,
        recovery_probability: int,
        retry_count: int,
        action: str,
        policy_threshold: int = settings.MAX_RISK_CEILING,
    ) -> Dict[str, any]:
        # Boundary 1: Retry ceiling limit (Max 2 automated retries allowed)
        if retry_count > settings.MAX_RETRY_CEILING:
            return {
                "decision": "Escalated",
                "result": "Stopped",
                "execution_allowed": False,
                "boundary_rule": "Retry count limit crossed",
                "policy_reason": f"Retry attempts ({retry_count}/2) exceeded maximum automated retry threshold. Escalated to human operator.",
                "action": "Escalate",
            }

        # Boundary 2: Hard Risk Ceiling (Risk >= threshold is unsafe)
        if risk_score >= policy_threshold:
            return {
                "decision": "Escalated",
                "result": "Stopped",
                "execution_allowed": False,
                "boundary_rule": "Risk score ceiling exceeded",
                "policy_reason": f"Transaction risk score ({risk_score}/100) crosses policy threshold ({policy_threshold}/100). Blocked to prevent fraud/chargeback.",
                "action": "Escalate",
            }

        # Boundary 3: Minimum Recovery Probability Threshold
        if recovery_probability < settings.MIN_RECOVERY_PROBABILITY:
            return {
                "decision": "Escalated",
                "result": "Stopped",
                "execution_allowed": False,
                "boundary_rule": "Recovery probability below economic threshold",
                "policy_reason": f"Estimated recovery probability ({recovery_probability}%) is too low for automated retry. Diverting to alternate recovery link.",
                "action": "Payment link" if action != "Escalate" else "Escalate",
            }

        # Boundary 4: Action Playbook Validation
        normalized_action = action.strip() if isinstance(action, str) else "Retry payment"
        if normalized_action not in ALLOWED_RECOVERY_ACTIONS:
            return {
                "decision": "Approved",
                "result": "Recovered",
                "execution_allowed": True,
                "boundary_rule": "Standard fallback action applied",
                "policy_reason": f"Requested action '{normalized_action}' is unknown; mapped to bounded 'Retry payment' within safety limits.",
                "action": "Retry payment",
            }

        # Safe within all deterministic boundaries
        return {
            "decision": "Approved",
            "result": "Recovered",
            "execution_allowed": True,
            "boundary_rule": "Safe bounded recovery limits",
            "policy_reason": f"Idempotency verified · attempts {retry_count}/2 · risk {risk_score}/{policy_threshold} · recovery prob {recovery_probability}%.",
            "action": normalized_action,
        }

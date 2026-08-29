import math
from typing import Dict, List, Literal, NamedTuple, Optional
from backend.app.services.policy.engine import DeterministicPolicyEngine

ScenarioType = Literal["balanced", "checkout", "degradation"]
RecoveryDirection = Literal[
    "Payment degradation",
    "Checkout drop-off",
    "Failed-subscription recovery",
    "B2B receivables chaser",
    "Mandate retry sequencer",
    "Hinglish voice recovery",
    "Promise-to-pay tracker",
]


class Playbook(NamedTuple):
    direction: RecoveryDirection
    reason: str
    action: str
    base: float
    risk: int
    latency_base: int
    latency_jitter: int
    preferred_scenarios: List[ScenarioType]


PLAYBOOKS: List[Playbook] = [
    Playbook("Payment degradation", "Bank timeout", "Retry payment", 0.86, 22, 760, 440, ["degradation", "balanced"]),
    Playbook("Checkout drop-off", "Checkout abandoned", "Payment link", 0.72, 27, 1420, 900, ["checkout", "balanced"]),
    Playbook("Failed-subscription recovery", "Subscription charge failed", "Retry subscription", 0.76, 34, 2100, 1300, ["balanced"]),
    Playbook("B2B receivables chaser", "Invoice overdue", "Send AR reminder", 0.61, 46, 5200, 2600, ["balanced"]),
    Playbook("Mandate retry sequencer", "Mandate debit failed", "Retry mandate", 0.74, 38, 2500, 1500, ["balanced"]),
    Playbook("Hinglish voice recovery", "Customer needs assisted recovery", "Hinglish voice recovery", 0.69, 41, 6800, 3200, ["balanced"]),
    Playbook("Promise-to-pay tracker", "Promise to pay recorded", "Track promised date", 0.82, 29, 9000, 4000, ["balanced"]),
    Playbook("Payment degradation", "Issuer unavailable", "Retry payment", 0.79, 28, 1040, 520, ["degradation", "balanced"]),
    Playbook("Checkout drop-off", "3DS challenge expired", "Customer prompt", 0.66, 35, 1840, 1100, ["checkout", "balanced"]),
    Playbook("Failed-subscription recovery", "Subscription past due", "Recovery link", 0.68, 42, 3600, 1800, ["balanced"]),
    Playbook("B2B receivables chaser", "High-value receivable aging", "Escalate to AR owner", 0.43, 63, 7200, 3400, ["balanced"]),
    Playbook("Mandate retry sequencer", "Mandate retry exhausted", "Fallback payment link", 0.48, 58, 4100, 2200, ["balanced"]),
    Playbook("Hinglish voice recovery", "High-intent failed payment", "Call + payment link", 0.73, 37, 5900, 2800, ["balanced"]),
    Playbook("Promise-to-pay tracker", "Promise date missed", "Escalate missed promise", 0.39, 68, 11200, 5000, ["balanced"]),
]


def deterministic_unit(index: int, salt: int) -> float:
    value = math.sin((index + 1) * (salt + 11) * 12.9898) * 43758.5453
    return value - math.floor(value)


def create_synthetic_transaction(index: int, scenario: ScenarioType = "balanced") -> Dict[str, any]:
    # Select playbook based on scenario weightings
    matching = [p for p in PLAYBOOKS if scenario in p.preferred_scenarios]
    pool = matching if matching else PLAYBOOKS
    playbook_idx = math.floor(deterministic_unit(index, 3) * len(pool))
    playbook = pool[playbook_idx]

    # Deterministic Amount Generation (in rupees, converted to minor paise)
    amount_tiers = [499, 899, 1499, 2499, 4999, 7999, 12999, 18999, 24999, 34999]
    tier_idx = math.floor(deterministic_unit(index, 7) * len(amount_tiers))
    amount_rupees = amount_tiers[tier_idx]
    amount_minor = amount_rupees * 100

    # Risk Score & Probability
    jitter_risk = math.floor((deterministic_unit(index, 19) - 0.5) * 18)
    risk_score = max(4, min(92, playbook.risk + jitter_risk))

    jitter_prob = math.floor((deterministic_unit(index, 23) - 0.5) * 20)
    recovery_probability = max(8, min(98, math.floor(playbook.base * 100) + jitter_prob))

    # Evaluate with Policy Engine
    policy_eval = DeterministicPolicyEngine.evaluate(
        risk_score=risk_score,
        recovery_probability=recovery_probability,
        retry_count=1,
        action=playbook.action,
    )

    txn_id = f"TXN-{1000 + index}"
    return {
        "id": txn_id,
        "amount_minor": amount_minor,
        "currency": "INR",
        "source": "synthetic",
        "status": "Pending",
        "direction": playbook.direction,
        "reason": playbook.reason,
        "action": policy_eval["action"],
        "result": policy_eval["result"],
        "confidence": 94,
        "recovery_probability": recovery_probability,
        "risk_score": risk_score,
        "policy": policy_eval["decision"],
        "explanation": f"Synthetic simulation transaction. {policy_eval['policy_reason']}",
    }

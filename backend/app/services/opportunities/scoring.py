from typing import Tuple
from backend.app.services.opportunities.schemas import (
    PriorityLevel,
    PolicyDecision,
    OpportunityExplainability,
)


class OpportunityScoringEngine:
    """
    Transparent, deterministic scoring and expected recovery value calculations.
    Uses safe integer minor currency units (paise) for exact financial precision.
    """

    @staticmethod
    def calculate_expected_recovery_value(amount_minor: int, recovery_probability: int) -> int:
        """
        Expected Recovery Value = Recoverable Amount (minor units) * Recovery Probability
        Example: ₹45,000 (4500000 paise) * 82% = ₹36,900 (3690000 paise)
        """
        if amount_minor <= 0:
            return 0
        clamped_prob = max(0, min(100, recovery_probability))
        return int((amount_minor * clamped_prob) / 100)

    @staticmethod
    def calculate_priority_score(
        expected_value_minor: int,
        recovery_probability: int,
        risk_score: int,
        age_hours: float = 1.0,
        policy_eligible: bool = True,
    ) -> Tuple[int, PriorityLevel]:
        """
        Transparent priority score (0 - 100) combining:
        1. Expected Value Component (0 - 45 pts): 1 pt per ₹1,000 recoverable up to ₹45k
        2. Recovery Likelihood Component (0 - 30 pts): Probability * 0.3
        3. Freshness / Urgency Component (0 - 10 pts): max(0, 10 - age_hours)
        4. Risk Penalty (0 - 15 pts): (Risk / 100) * 15
        5. Policy Eligibility Gate: -35 pts if policy blocked / escalated

        Formula:
            Raw Score = EV_pts + Prob_pts + Urgency_pts - Risk_penalty - Policy_penalty
        """
        if expected_value_minor <= 0:
            return 0, "LOW"

        # 1. Expected Value (₹1,000 = 100,000 minor units)
        ev_rupees = expected_value_minor / 100.0
        ev_pts = min(45.0, (ev_rupees / 1000.0) * 1.0)

        # 2. Probability pts
        prob_pts = (max(0, min(100, recovery_probability)) / 100.0) * 30.0

        # 3. Urgency pts
        urgency_pts = max(0.0, min(10.0, 10.0 - (age_hours * 0.5)))

        # 4. Risk penalty
        risk_penalty = (max(0, min(100, risk_score)) / 100.0) * 15.0

        # 5. Policy eligibility penalty
        policy_penalty = 0.0 if policy_eligible else 35.0

        raw_score = ev_pts + prob_pts + urgency_pts - risk_penalty - policy_penalty
        final_score = int(max(0, min(100, round(raw_score))))

        # Level determination
        if final_score >= 75:
            level: PriorityLevel = "CRITICAL"
        elif final_score >= 55:
            level = "HIGH"
        elif final_score >= 35:
            level = "MEDIUM"
        else:
            level = "LOW"

        return final_score, level

    @staticmethod
    def generate_explainability(
        amount_minor: int,
        expected_value_minor: int,
        recovery_probability: int,
        risk_score: int,
        failure_signature: str,
        recommended_action: str,
        policy_status: PolicyDecision,
        policy_reason: str,
    ) -> OpportunityExplainability:
        """
        Generates explainable, audited rationale answering:
        1. Why is this priority assigned?
        2. Why is this specific recovery action recommended?
        3. Why is the policy status Approved / Blocked / Escalated?
        """
        amount_fmt = f"₹{amount_minor / 100:,.0f}"
        ev_fmt = f"₹{expected_value_minor / 100:,.0f}"

        # 1. Why priority
        if policy_status == "Blocked":
            why_priority = (
                f"Low operational priority because transaction carries high risk ({risk_score}/100) "
                f"and is blocked by deterministic safety gates."
            )
        elif expected_value_minor >= 2500000 and recovery_probability >= 75:
            why_priority = (
                f"Critical priority due to high recoverable value ({ev_fmt} expected out of {amount_fmt}), "
                f"high recovery probability ({recovery_probability}%), and low risk ({risk_score}/100)."
            )
        elif expected_value_minor >= 1000000:
            why_priority = (
                f"High priority with {ev_fmt} expected recovery ({recovery_probability}% probability) "
                f"under standard merchant risk boundaries ({risk_score}/100)."
            )
        else:
            why_priority = (
                f"Standard queue priority with {ev_fmt} expected yield ({recovery_probability}% likelihood) "
                f"for failure signal '{failure_signature}'."
            )

        # 2. Why action
        if recommended_action == "Payment link":
            why_action = (
                f"Smart Payment Link is recommended to bypass checkout abandonment / expired sessions "
                f"by delivering an instant, authenticated payment token directly to the buyer."
            )
        elif recommended_action == "Retry payment":
            why_action = (
                f"Automated gateway retry is recommended for transient '{failure_signature}' "
                f"as the payment route has stabilized and retry limits are within safety ceiling."
            )
        elif recommended_action == "Customer prompt":
            why_action = (
                f"In-app re-authentication prompt is recommended to re-engage the customer "
                f"for incomplete 3DS authentication without charging duplicate mandates."
            )
        elif recommended_action == "Hinglish voice recovery":
            why_action = (
                f"Assisted voice & WhatsApp recovery is recommended for high-value orders "
                f"to provide personalized checkout support."
            )
        elif recommended_action == "Promise-to-pay tracker":
            why_action = (
                f"Promise-to-Pay (PTP) tracking is recommended for delayed B2B invoice settlements "
                f"with automated ledger reconciliation."
            )
        else:
            why_action = (
                f"Manual escalation is recommended because automated retries exceed safe risk boundaries."
            )

        # 3. Why policy status
        if policy_status == "Approved":
            why_policy = f"Authorized: {policy_reason}"
        elif policy_status == "Blocked":
            why_policy = f"Blocked by Safety Gate: {policy_reason}"
        else:
            why_policy = f"Escalated for Operator Review: {policy_reason}"

        return OpportunityExplainability(
            why_priority=why_priority,
            why_action=why_action,
            why_policy_status=why_policy,
        )

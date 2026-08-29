from typing import List, Optional
from datetime import datetime, timezone
import uuid

from backend.app.schemas.domain import (
    RecoveryOpportunityResponse,
    PriorityType,
    TransactionResponse,
)


class OpportunityEngine:
    """
    Finds and ranks recoverable revenue opportunities.
    Formula:
        Expected Recovery Value = Recoverable Amount * Recovery Probability
    Ranks highest-value safe opportunities first.
    """

    @staticmethod
    def calculate_expected_value_minor(amount_minor: int, probability_percent: int) -> int:
        return int((amount_minor * max(0, min(100, probability_percent))) / 100)

    @staticmethod
    def determine_priority(expected_value_minor: int, risk_score: int) -> PriorityType:
        # Values in paise: ₹50,000 = 5000000 paise
        if expected_value_minor >= 3000000 and risk_score < 40:
            return "CRITICAL"
        elif expected_value_minor >= 1000000 and risk_score < 60:
            return "HIGH"
        elif expected_value_minor >= 300000:
            return "MEDIUM"
        return "LOW"

    @classmethod
    def create_opportunity(
        cls,
        transaction_id: str,
        amount_minor: int,
        recovery_probability: int,
        risk_score: int,
        reason: str,
        recommended_action: str,
        policy_status: str = "Approved",
    ) -> RecoveryOpportunityResponse:
        expected_val = cls.calculate_expected_value_minor(amount_minor, recovery_probability)
        priority = cls.determine_priority(expected_val, risk_score)
        
        return RecoveryOpportunityResponse(
            id=str(uuid.uuid4()),
            transaction_id=transaction_id,
            amount_minor=amount_minor,
            recovery_probability=recovery_probability,
            expected_value_minor=expected_val,
            priority=priority,
            recommended_action=recommended_action,
            policy_status=policy_status,
            reason=reason,
            risk_score=risk_score,
            created_at=datetime.now(timezone.utc),
        )

    @classmethod
    def rank_opportunities(
        cls,
        opportunities: List[RecoveryOpportunityResponse],
    ) -> List[RecoveryOpportunityResponse]:
        # Sort priority:
        # 1. Approved policies over Escalated
        # 2. Expected value descending
        # 3. Lower risk score
        return sorted(
            opportunities,
            key=lambda opp: (
                1 if opp.policy_status == "Approved" else 0,
                opp.expected_value_minor,
                -opp.risk_score,
            ),
            reverse=True,
        )

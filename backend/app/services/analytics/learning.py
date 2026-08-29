from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.models import (
    TransactionModel,
    PaymentVerificationModel,
    RecoveryActionModel,
)
from backend.app.schemas.domain import (
    HistoricalAnalyticsResponse,
    ActionPerformanceItem,
    FailureDistributionItem,
)


class HistoricalLearningService:
    """
    Transparent statistical learning from verified payment outcomes.
    Aggregates empirical success rates and revenue amounts without unverified claims.
    """

    @classmethod
    def get_recovery_analytics(cls, db: Session) -> HistoricalAnalyticsResponse:
        transactions = db.query(TransactionModel).all()
        
        total_at_risk_minor = sum(t.amount_minor for t in transactions)
        total_recovered_minor = sum(t.verified_amount_minor for t in transactions if t.status == "RECOVERED")
        
        recovered_count = sum(1 for t in transactions if t.status == "RECOVERED")
        total_count = len(transactions)
        
        overall_rate = round((recovered_count / total_count * 100), 1) if total_count > 0 else 0.0

        # Action Performance aggregation
        action_map = {}
        for t in transactions:
            act = t.action or "Retry payment"
            if act not in action_map:
                action_map[act] = {"attempts": 0, "recovered": 0, "recovered_minor": 0}
            action_map[act]["attempts"] += 1
            if t.status == "RECOVERED":
                action_map[act]["recovered"] += 1
                action_map[act]["recovered_minor"] += t.verified_amount_minor

        action_performance: List[ActionPerformanceItem] = []
        for act, data in action_map.items():
            rate = round((data["recovered"] / data["attempts"] * 100), 1) if data["attempts"] > 0 else 0.0
            action_performance.append(
                ActionPerformanceItem(
                    action=act,
                    total_attempts=data["attempts"],
                    verified_recoveries=data["recovered"],
                    success_rate=rate,
                    total_recovered_minor=data["recovered_minor"],
                )
            )

        # Failure Distributions
        failure_map = {}
        for t in transactions:
            reason = t.reason or "Unknown degradation"
            if reason not in failure_map:
                failure_map[reason] = {"count": 0, "at_risk_minor": 0, "recovered_minor": 0, "recovered_count": 0}
            failure_map[reason]["count"] += 1
            failure_map[reason]["at_risk_minor"] += t.amount_minor
            if t.status == "RECOVERED":
                failure_map[reason]["recovered_count"] += 1
                failure_map[reason]["recovered_minor"] += t.verified_amount_minor

        failure_distributions: List[FailureDistributionItem] = []
        for sig, data in failure_map.items():
            rate = round((data["recovered_count"] / data["count"] * 100), 1) if data["count"] > 0 else 0.0
            failure_distributions.append(
                FailureDistributionItem(
                    failure_signature=sig,
                    count=data["count"],
                    total_at_risk_minor=data["at_risk_minor"],
                    recovered_minor=data["recovered_minor"],
                    recovery_rate=rate,
                )
            )

        return HistoricalAnalyticsResponse(
            overall_recovery_rate=overall_rate,
            total_revenue_at_risk_minor=total_at_risk_minor,
            total_revenue_recovered_minor=total_recovered_minor,
            action_performance=action_performance,
            failure_distributions=failure_distributions,
        )

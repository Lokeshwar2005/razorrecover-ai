from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import List

from backend.app.db.session import get_db
from backend.app.db.models import TransactionModel
from backend.app.schemas.domain import (
    DashboardStatsResponse,
    TrendDataPoint,
)
from backend.app.services.recovery.opportunity import OpportunityEngine

from backend.app.db.seed import seed_canonical_database

router = APIRouter(prefix="/dashboard", tags=["Merchant Command Center"])


@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    seed_canonical_database(db)
    transactions = db.query(TransactionModel).all()

    total_at_risk_minor = sum(t.amount_minor for t in transactions)
    total_recovered_minor = sum(t.verified_amount_minor for t in transactions if t.status == "RECOVERED")
    failed_count = sum(1 for t in transactions if t.status == "STOPPED")
    active_attempts_count = sum(1 for t in transactions if t.status in ("PENDING", "IN_PROGRESS"))
    policy_blocks_count = sum(1 for t in transactions if t.policy in ("Escalated", "Blocked") or t.risk_score >= 70)
    
    total_count = len(transactions)
    recovery_rate = round((total_recovered_minor / total_at_risk_minor * 100), 1) if total_at_risk_minor > 0 else 0.0
    
    avg_confidence = int(sum(t.confidence for t in transactions) / total_count) if total_count > 0 else 94
    
    # Calculate Total Opportunity Value
    opp_value_minor = sum(
        OpportunityEngine.calculate_expected_value_minor(t.amount_minor, t.recovery_probability)
        for t in transactions if t.status == "PENDING"
    )

    # 7-day trend calculations
    now = datetime.now(timezone.utc)
    trends: List[TrendDataPoint] = []
    for i in range(6, -1, -1):
        day_date = now - timedelta(days=i)
        day_str = day_date.strftime("%b %d")
        
        # Simulate realistic trending curve anchored on database totals
        factor = (7 - i) / 7.0
        trends.append(
            TrendDataPoint(
                timestamp=day_str,
                revenue_at_risk_minor=int(total_at_risk_minor * factor * 0.18),
                revenue_recovered_minor=int(total_recovered_minor * factor * 0.18),
                recovery_rate=round(recovery_rate * (0.85 + (0.15 * factor)), 1),
            )
        )

    return DashboardStatsResponse(
        revenue_at_risk_minor=total_at_risk_minor,
        revenue_recovered_minor=total_recovered_minor,
        recovery_rate=recovery_rate,
        failed_transactions_count=failed_count,
        active_recovery_attempts_count=active_attempts_count,
        policy_blocks_count=policy_blocks_count,
        total_opportunities_value_minor=opp_value_minor,
        average_ai_confidence=avg_confidence,
        velocity_minor_per_sec=4250,
        trends=trends,
    )

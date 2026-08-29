from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.db.session import get_db
from backend.app.db.models import TransactionModel
from backend.app.schemas.domain import StrategyOptimizationResponse
from backend.app.services.recovery.optimizer import StrategyOptimizer
from backend.app.services.opportunities.schemas import (
    OpportunityDetailResponse,
    OpportunitySummaryMetrics,
    OpportunityEvaluateRequest,
)
from backend.app.services.opportunities.service import OpportunityService

router = APIRouter(prefix="/opportunities", tags=["Recovery Opportunities"])


@router.get("", response_model=List[OpportunityDetailResponse])
def list_ranked_opportunities(
    priority: Optional[str] = Query(None, description="Filter by priority: CRITICAL, HIGH, MEDIUM, LOW"),
    policy_status: Optional[str] = Query(None, description="Filter by policy status: Approved, Blocked, Escalated"),
    status: Optional[str] = Query(None, description="Filter by opportunity status: PENDING, FAILED, etc."),
    source: Optional[str] = Query(None, description="Filter by source: synthetic, razorpay_test, live"),
    search: Optional[str] = Query(None, description="Search by ID, reason, or action"),
    sort_by: str = Query("expected_value", description="Sort by: expected_value, amount, probability, risk, priority, created_at"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Returns prioritized recovery opportunities ranked by Expected Recovery Value (Amount * Probability).
    """
    return OpportunityService.get_opportunities(
        db=db,
        priority=priority,
        policy_status=policy_status,
        status=status,
        source=source,
        search=search,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )


@router.get("/summary", response_model=OpportunitySummaryMetrics)
def get_opportunity_summary_metrics(
    db: Session = Depends(get_db),
):
    """
    Returns high-level recovery opportunity metrics: total opportunities, revenue at risk,
    expected recovery yield, policy eligible vs blocked count.
    """
    return OpportunityService.get_summary_metrics(db=db)


@router.post("/refresh", response_model=List[OpportunityDetailResponse])
def refresh_opportunity_queue(
    db: Session = Depends(get_db),
):
    """
    Scans the database and refreshes all active recovery opportunities against current policy thresholds.
    """
    return OpportunityService.refresh_opportunities(db=db)


@router.get("/{opportunity_id}", response_model=OpportunityDetailResponse)
def get_opportunity_detail(
    opportunity_id: str,
    db: Session = Depends(get_db),
):
    """
    Returns complete opportunity breakdown including Candidate Action Evaluations,
    Deterministic Policy Gate analysis, and audited explainability.
    """
    opp = OpportunityService.get_opportunity_by_id(db=db, opportunity_id=opportunity_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Recovery opportunity not found")
    return opp


@router.post("/{opportunity_id}/evaluate", response_model=OpportunityDetailResponse)
def evaluate_opportunity_action(
    opportunity_id: str,
    req: OpportunityEvaluateRequest = OpportunityEvaluateRequest(),
    db: Session = Depends(get_db),
):
    """
    Evaluates candidate playbooks for a specific opportunity using custom merchant thresholds.
    """
    opp = OpportunityService.get_opportunity_by_id(db=db, opportunity_id=opportunity_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Recovery opportunity not found")
    return opp


@router.post("/optimize/{transaction_id}", response_model=StrategyOptimizationResponse)
def optimize_transaction_recovery_strategy(
    transaction_id: str,
    policy_threshold: int = Query(70, ge=50, le=95),
    db: Session = Depends(get_db),
):
    """
    Evaluates candidate playbooks and selects the best safe recovery action permitted by policy.
    """
    txn = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return StrategyOptimizer.optimize(
        transaction_id=txn.id,
        amount_minor=txn.amount_minor,
        reason=txn.reason,
        base_risk_score=txn.risk_score,
        base_recovery_probability=txn.recovery_probability,
        retry_count=1,
        policy_threshold=policy_threshold,
    )

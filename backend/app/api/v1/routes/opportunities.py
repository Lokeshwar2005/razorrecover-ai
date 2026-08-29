from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.app.db.session import get_db
from backend.app.db.models import TransactionModel
from backend.app.schemas.domain import (
    RecoveryOpportunityResponse,
    StrategyOptimizationResponse,
)
from backend.app.services.recovery.opportunity import OpportunityEngine
from backend.app.services.recovery.optimizer import StrategyOptimizer

router = APIRouter(prefix="/opportunities", tags=["Recovery Opportunities"])


@router.get("", response_model=List[RecoveryOpportunityResponse])
def get_ranked_opportunities(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    transactions = db.query(TransactionModel).filter(TransactionModel.status == "PENDING").all()
    
    opportunities: List[RecoveryOpportunityResponse] = []
    for t in transactions:
        opp = OpportunityEngine.create_opportunity(
            transaction_id=t.id,
            amount_minor=t.amount_minor,
            recovery_probability=t.recovery_probability,
            risk_score=t.risk_score,
            reason=t.reason,
            recommended_action=t.action,
            policy_status=t.policy,
        )
        opportunities.append(opp)

    ranked = OpportunityEngine.rank_opportunities(opportunities)
    return ranked[:limit]


@router.post("/optimize/{transaction_id}", response_model=StrategyOptimizationResponse)
def optimize_transaction_recovery_strategy(
    transaction_id: str,
    policy_threshold: int = Query(70, ge=50, le=95),
    db: Session = Depends(get_db),
):
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

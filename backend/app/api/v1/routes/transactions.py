from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from backend.app.db.session import get_db
from backend.app.db.models import (
    TransactionModel,
    FailureEventModel,
    AIDiagnosisModel,
    PolicyDecisionModel,
    RecoveryActionModel,
    PaymentVerificationModel,
    AuditEventModel,
    AgentTraceModel,
)
from backend.app.schemas.domain import (
    TransactionResponse,
    TransactionCreate,
)
from backend.app.services.recovery.engine import create_synthetic_transaction

router = APIRouter(prefix="/transactions", tags=["Transaction Intelligence"])


def seed_synthetic_transactions_if_empty(db: Session, scenario: str = "balanced") -> None:
    if db.query(TransactionModel).count() == 0:
        for i in range(100):
            txn_dict = create_synthetic_transaction(i, scenario)
            txn = TransactionModel(
                id=txn_dict["id"],
                amount_minor=txn_dict["amount_minor"],
                currency=txn_dict["currency"],
                source=txn_dict["source"],
                status=txn_dict["status"],
                direction=txn_dict["direction"],
                reason=txn_dict["reason"],
                action=txn_dict["action"],
                confidence=txn_dict["confidence"],
                recovery_probability=txn_dict["recovery_probability"],
                risk_score=txn_dict["risk_score"],
                policy=txn_dict["policy"],
                explanation=txn_dict["explanation"],
            )
            db.add(txn)
        db.commit()


@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="Filter by status: PENDING, RECOVERED, STOPPED"),
    policy: Optional[str] = Query(None, description="Filter by policy: Approved, Escalated"),
    filter_type: Optional[str] = Query(
        None,
        description="Filter type: high_risk, high_value, failed, pending, recovered, blocked, escalated",
    ),
    search: Optional[str] = Query(None, description="Search by ID, reason, or action"),
    scenario: str = Query("balanced"),
    sort_by: str = Query("created_at", description="Sort by: created_at, amount_minor, risk_score, recovery_probability"),
    order: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    seed_synthetic_transactions_if_empty(db, scenario)
    query = db.query(TransactionModel)

    if status:
        query = query.filter(TransactionModel.status == status.upper())
    
    if policy:
        query = query.filter(TransactionModel.policy == policy.capitalize())

    if filter_type:
        ft = filter_type.lower()
        if ft == "high_risk":
            query = query.filter(TransactionModel.risk_score >= 60)
        elif ft == "high_value":
            query = query.filter(TransactionModel.amount_minor >= 2000000)  # >= ₹20,000
        elif ft == "failed" or ft == "stopped":
            query = query.filter(TransactionModel.status == "STOPPED")
        elif ft == "pending":
            query = query.filter(TransactionModel.status == "PENDING")
        elif ft == "recovered":
            query = query.filter(TransactionModel.status == "RECOVERED")
        elif ft == "blocked" or ft == "escalated":
            query = query.filter(TransactionModel.policy == "Escalated")

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (TransactionModel.id.ilike(search_pattern))
            | (TransactionModel.reason.ilike(search_pattern))
            | (TransactionModel.action.ilike(search_pattern))
        )

    # Sorting
    sort_col = getattr(TransactionModel, sort_by, TransactionModel.created_at)
    if order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return query.offset(offset).limit(limit).all()


@router.get("/{transaction_id}")
def get_transaction_detail(transaction_id: str, db: Session = Depends(get_db)):
    seed_synthetic_transactions_if_empty(db)
    txn = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    failure_events = db.query(FailureEventModel).filter(FailureEventModel.transaction_id == transaction_id).all()
    diagnoses = db.query(AIDiagnosisModel).filter(AIDiagnosisModel.transaction_id == transaction_id).all()
    policy_decisions = db.query(PolicyDecisionModel).filter(PolicyDecisionModel.transaction_id == transaction_id).all()
    recovery_actions = db.query(RecoveryActionModel).filter(RecoveryActionModel.transaction_id == transaction_id).all()
    verifications = db.query(PaymentVerificationModel).filter(PaymentVerificationModel.transaction_id == transaction_id).all()
    audit_events = db.query(AuditEventModel).filter(AuditEventModel.transaction_id == transaction_id).order_by(AuditEventModel.recorded_at.asc()).all()
    agent_traces = db.query(AgentTraceModel).filter(AgentTraceModel.transaction_id == transaction_id).order_by(AgentTraceModel.stage_index.asc()).all()

    return {
        "transaction": TransactionResponse.model_validate(txn),
        "failure_events": failure_events,
        "ai_diagnoses": diagnoses,
        "policy_decisions": policy_decisions,
        "recovery_actions": recovery_actions,
        "payment_verifications": verifications,
        "audit_events": audit_events,
        "agent_traces": agent_traces,
    }

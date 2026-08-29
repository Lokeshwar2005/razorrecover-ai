from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
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
from backend.app.db.seed import seed_canonical_database
from backend.app.services.razorpay.service import RazorpayService

router = APIRouter(prefix="/transactions", tags=["Transaction Intelligence"])


@router.get("", response_model=List[TransactionResponse])
def list_transactions(
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None, description="Filter by status: PENDING, RECOVERED, STOPPED"),
    source: Optional[str] = Query(None, description="Filter by source: synthetic, razorpay_test, live"),
    policy: Optional[str] = Query(None, description="Filter by policy: Approved, Escalated, Blocked"),
    filter_type: Optional[str] = Query(
        None,
        description="Filter type: high_risk, high_value, failed, pending, recovered, blocked, escalated",
    ),
    search: Optional[str] = Query(None, description="Search by ID (e.g. 1033, TXN-1033), provider payment ID, reason, or action"),
    scenario: str = Query("balanced"),
    sort_by: str = Query("created_at", description="Sort by: created_at, amount_minor, risk_score, recovery_probability"),
    order: str = Query("desc", description="asc or desc"),
    db: Session = Depends(get_db),
):
    seed_canonical_database(db, scenario)
    query = db.query(TransactionModel)

    if status and status.upper() != "ALL":
        query = query.filter(TransactionModel.status == status.upper())

    if source and source.lower() != "all":
        query = query.filter(TransactionModel.source == source.lower())
    
    if policy and policy.capitalize() != "All":
        query = query.filter(TransactionModel.policy == policy.capitalize())

    if filter_type:
        ft = filter_type.lower()
        if ft == "high_risk":
            query = query.filter(TransactionModel.risk_score >= 60)
        elif ft == "high_value":
            query = query.filter(TransactionModel.amount_minor >= 2000000)  # >= ₹20,000
        elif ft in ("failed", "stopped"):
            query = query.filter(TransactionModel.status == "STOPPED")
        elif ft == "pending":
            query = query.filter(TransactionModel.status == "PENDING")
        elif ft == "recovered":
            query = query.filter(TransactionModel.status == "RECOVERED")
        elif ft in ("blocked", "escalated"):
            query = query.filter((TransactionModel.policy == "Escalated") | (TransactionModel.risk_score >= 70))

    if search:
        s = search.strip()
        search_pattern = f"%{s}%"
        # Support numeric only e.g. "1033" matches "TXN-1033"
        clean_num = s.lower().replace("txn-", "").replace("txn", "")
        clean_pattern = f"%{clean_num}%" if clean_num else search_pattern

        query = query.filter(
            (TransactionModel.id.ilike(search_pattern))
            | (TransactionModel.id.ilike(clean_pattern))
            | (TransactionModel.provider_id.ilike(search_pattern))
            | (TransactionModel.reason.ilike(search_pattern))
            | (TransactionModel.action.ilike(search_pattern))
            | (TransactionModel.source.ilike(search_pattern))
            | (TransactionModel.status.ilike(search_pattern))
        )

    # Sorting
    sort_col = getattr(TransactionModel, sort_by, TransactionModel.created_at)
    if order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    return query.offset(offset).limit(limit).all()


@router.post("/sync")
async def sync_provider_transactions(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Authoritative backend sync: fetches latest Razorpay payments,
    normalizes them into canonical transaction records, and upserts them into the database.
    """
    feed = await RazorpayService.list_payments(count=100)
    raw_items = feed.get("items", [])
    now = datetime.now(timezone.utc)
    new_count = 0
    updated_count = 0

    existing_map = {t.id: t for t in db.query(TransactionModel).all()}

    for p in raw_items:
        payment_id = p.get("id")
        if not payment_id:
            continue
        
        txn_id = p.get("notes", {}).get("transaction_id") or f"RZP-{payment_id}"
        amount_minor = p.get("amount", 0)
        currency = (p.get("currency") or "INR").upper()
        status_lower = (p.get("status") or "pending").lower()
        reason = p.get("error_description") or ("Checkout capture received" if status_lower == "captured" else "Gateway degradation / bank timeout")
        direction = "Failed-subscription recovery" if "subscription" in reason.lower() else "Payment degradation"

        if txn_id in existing_map:
            # Update existing record
            existing_txn = existing_map[txn_id]
            if existing_txn.status != "RECOVERED":
                existing_txn.amount_minor = amount_minor
                existing_txn.currency = currency
                existing_txn.reason = reason
                existing_txn.provider_id = payment_id
                updated_count += 1
        else:
            # Insert new record
            new_txn = TransactionModel(
                id=txn_id,
                merchant_id=p.get("notes", {}).get("merchant_id", "mer_razorpay"),
                amount_minor=amount_minor,
                currency=currency,
                source="razorpay_test",
                status="STOPPED" if status_lower == "failed" else "PENDING",
                direction=direction,
                reason=reason,
                action="Retry payment" if status_lower == "failed" else "Review payment",
                confidence=94,
                recovery_probability=72 if status_lower == "failed" else 88,
                risk_score=32 if status_lower == "failed" else 12,
                policy="Approved",
                explanation=f"Ingested from Razorpay Test Mode payment {payment_id}.",
                provider_id=payment_id,
                verified_amount_minor=0,
            )
            db.add(new_txn)
            existing_map[txn_id] = new_txn
            new_count += 1

    if new_count > 0 or updated_count > 0:
        db.commit()

    total_canonical = db.query(TransactionModel).count()

    return {
        "status": "success",
        "synced_count": len(raw_items),
        "new_records": new_count,
        "updated_records": updated_count,
        "total_canonical_transactions": total_canonical,
        "last_synced_at": now.isoformat(),
    }


@router.get("/{transaction_id}")
def get_transaction_detail(transaction_id: str, db: Session = Depends(get_db)):
    seed_canonical_database(db)
    clean_id = transaction_id.replace("opp-", "")
    txn = db.query(TransactionModel).filter(
        (TransactionModel.id == transaction_id) | (TransactionModel.id == clean_id)
    ).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    failure_events = db.query(FailureEventModel).filter(FailureEventModel.transaction_id == txn.id).all()
    diagnoses = db.query(AIDiagnosisModel).filter(AIDiagnosisModel.transaction_id == txn.id).all()
    policy_decisions = db.query(PolicyDecisionModel).filter(PolicyDecisionModel.transaction_id == txn.id).all()
    recovery_actions = db.query(RecoveryActionModel).filter(RecoveryActionModel.transaction_id == txn.id).all()
    verifications = db.query(PaymentVerificationModel).filter(PaymentVerificationModel.transaction_id == txn.id).all()
    audit_events = db.query(AuditEventModel).filter(AuditEventModel.transaction_id == txn.id).order_by(AuditEventModel.recorded_at.asc()).all()
    agent_traces = db.query(AgentTraceModel).filter(AgentTraceModel.transaction_id == txn.id).order_by(AgentTraceModel.stage_index.asc()).all()

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

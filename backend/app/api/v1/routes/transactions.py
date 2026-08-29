from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.db.models import TransactionModel
from backend.app.db.session import get_db
from backend.app.schemas.domain import TransactionCreate, TransactionResponse
from backend.app.services.recovery.engine import create_synthetic_transaction

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    scenario: str = Query(default="balanced", enum=["balanced", "checkout", "degradation"]),
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Returns transactions from durable database, or seeds 100 deterministic transactions
    if database is fresh.
    """
    txns = db.query(TransactionModel).order_by(TransactionModel.created_at.desc()).limit(limit).all()
    if not txns:
        # Seed 100 deterministic transactions
        seeded: List[TransactionModel] = []
        for i in range(100):
            data = create_synthetic_transaction(i, scenario)
            model = TransactionModel(
                id=data["id"],
                amount_minor=data["amount_minor"],
                currency=data["currency"],
                source=data["source"],
                status=data["status"],
                direction=data["direction"],
                reason=data["reason"],
                action=data["action"],
                confidence=data["confidence"],
                recovery_probability=data["recovery_probability"],
                risk_score=data["risk_score"],
                policy=data["policy"],
                explanation=data["explanation"],
            )
            db.add(model)
            seeded.append(model)
        db.commit()
        for s in seeded:
            db.refresh(s)
        return seeded

    return txns


@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
):
    """Returns single transaction details by ID."""
    txn = db.query(TransactionModel).filter(TransactionModel.id == transaction_id).first()
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction '{transaction_id}' not found",
        )
    return txn

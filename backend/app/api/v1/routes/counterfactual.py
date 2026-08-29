import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.models import CounterfactualRunModel, TransactionModel
from backend.app.db.session import get_db
from backend.app.schemas.domain import (
    CounterfactualRequest,
    CounterfactualResponse,
)
from backend.app.services.recovery.counterfactual import CounterfactualService

router = APIRouter(prefix="/counterfactual", tags=["Counterfactual Simulation"])


@router.post("/evaluate", response_model=CounterfactualResponse)
async def evaluate_counterfactual(
    request: CounterfactualRequest,
    db: Session = Depends(get_db),
):
    """
    Evaluates 'What-If' conditions against the Deterministic Policy Engine.
    GUARANTEE: The original transaction records are NEVER modified.
    """
    txn = db.query(TransactionModel).filter(TransactionModel.id == request.original_transaction_id).first()
    
    orig_dict = {
        "id": txn.id if txn else request.original_transaction_id,
        "amount_minor": txn.amount_minor if txn else request.amount_minor,
        "reason": txn.reason if txn else "Network degradation",
        "risk_score": txn.risk_score if txn else 28,
        "recovery_probability": txn.recovery_probability if txn else 72,
        "policy": txn.policy if txn else "Approved",
        "result": txn.status if txn else "Pending",
    }

    cf_response = CounterfactualService.evaluate(orig_dict, request)

    # Persist simulation run
    run_record = CounterfactualRunModel(
        original_transaction_id=request.original_transaction_id,
        input_amount_minor=request.amount_minor,
        input_reason=request.reason,
        input_risk_score=request.risk_score,
        input_recovery_probability=request.recovery_probability,
        input_retry_attempts=request.retry_attempts,
        input_policy_threshold=request.policy_threshold,
        original_decision=cf_response.original_decision,
        counterfactual_decision=cf_response.counterfactual_decision,
        outcome_flipped=cf_response.outcome_flipped,
        delta_json=json.dumps([d.model_dump() for d in cf_response.deltas]),
        explanation=cf_response.explanation,
        executed_at=cf_response.simulated_at,
    )
    db.add(run_record)
    db.commit()

    return cf_response

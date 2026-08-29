from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db.models import (
    AgentTraceModel,
    PaymentVerificationModel,
    PolicyDecisionModel,
    RecoveryActionModel,
    TransactionModel,
)
from backend.app.db.session import get_db
from backend.app.schemas.domain import (
    AIDiagnosisRequest,
    AIDiagnosisResponse,
    PaymentVerificationRequest,
    PaymentVerificationResponse,
    PolicyEvaluationRequest,
    PolicyEvaluationResponse,
    RecoveryExecutionRequest,
    RecoveryExecutionResponse,
)
from backend.app.services.ai.diagnosis import AIDiagnosisService
from backend.app.services.audit.ledger import AuditLedgerService
from backend.app.services.policy.engine import DeterministicPolicyEngine
from backend.app.services.razorpay.service import RazorpayService

router = APIRouter(prefix="/recovery", tags=["Recovery"])


@router.post("/diagnose", response_model=AIDiagnosisResponse)
async def diagnose_transaction(
    request: AIDiagnosisRequest,
    db: Session = Depends(get_db),
):
    """
    AI Diagnosis Layer.
    Returns structured failure classification and recommended bounded intervention.
    """
    diagnosis = await AIDiagnosisService.diagnose(request)
    
    # Record trace step
    AuditLedgerService.record_event(
        db=db,
        transaction_id=request.transaction.id,
        event_type="AI_DIAGNOSIS_CREATED",
        actor=f"AI Agent ({diagnosis.model_name})",
        decision=diagnosis.policy_alignment,
        reason=diagnosis.root_cause,
        metadata={
            "recommended_action": diagnosis.recommended_action,
            "confidence": diagnosis.confidence,
            "recovery_probability": diagnosis.recovery_probability,
        },
    )
    return diagnosis


@router.post("/evaluate", response_model=PolicyEvaluationResponse)
async def evaluate_policy(
    request: PolicyEvaluationRequest,
    db: Session = Depends(get_db),
):
    """
    Deterministic Safety Gate.
    The strict source of truth for authorization of money-moving actions.
    """
    eval_result = DeterministicPolicyEngine.evaluate(
        risk_score=request.risk_score,
        recovery_probability=request.recovery_probability,
        retry_count=request.retry_count,
        action=request.action,
        policy_threshold=request.policy_threshold,
    )

    # Persist policy decision
    policy_record = PolicyDecisionModel(
        transaction_id=request.transaction_id,
        risk_score=request.risk_score,
        recovery_probability=request.recovery_probability,
        retry_count=request.retry_count,
        decision=eval_result["decision"],
        boundary_rule=eval_result["boundary_rule"],
        policy_reason=eval_result["policy_reason"],
        execution_allowed=eval_result["execution_allowed"],
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(policy_record)
    
    # Update transaction policy status
    txn = db.query(TransactionModel).filter(TransactionModel.id == request.transaction_id).first()
    if txn:
        txn.policy = eval_result["decision"]
        txn.status = eval_result["result"]
        txn.action = eval_result["action"]
    db.commit()

    # Record Audit Event
    AuditLedgerService.record_event(
        db=db,
        transaction_id=request.transaction_id,
        event_type=f"POLICY_{eval_result['decision'].upper()}",
        actor="Deterministic Policy Gate",
        decision=eval_result["decision"],
        reason=eval_result["boundary_rule"],
        metadata={
            "risk_score": request.risk_score,
            "retry_count": request.retry_count,
            "execution_allowed": eval_result["execution_allowed"],
        },
    )

    return PolicyEvaluationResponse(
        decision=eval_result["decision"],
        execution_allowed=eval_result["execution_allowed"],
        boundary_rule=eval_result["boundary_rule"],
        policy_reason=eval_result["policy_reason"],
        recommended_action=eval_result["action"],
        risk_score=request.risk_score,
        recovery_probability=request.recovery_probability,
        retry_count=request.retry_count,
    )


@router.post("/execute", response_model=RecoveryExecutionResponse)
async def execute_recovery_action(
    request: RecoveryExecutionRequest,
    db: Session = Depends(get_db),
):
    """
    Executes a bounded recovery action through deterministic policy validation
    and Razorpay Test Mode Order/Payment Link generation.
    """
    now = datetime.now(timezone.utc)
    order_id = None
    payment_link = None
    key_id = None

    # 1. Lookup Transaction
    txn = db.query(TransactionModel).filter(TransactionModel.id == request.transaction_id).first()
    risk_score = txn.risk_score if txn else 30
    recovery_probability = txn.recovery_probability if txn else 75
    retry_count = 1

    # 2. Evaluate Deterministic Policy Gate
    policy_eval = DeterministicPolicyEngine.evaluate(
        risk_score=risk_score,
        recovery_probability=recovery_probability,
        retry_count=retry_count,
        action=request.action_type,
    )

    if not policy_eval["execution_allowed"]:
        # Blocked or Escalated by deterministic policy gate
        block_decision = policy_eval["decision"]
        block_reason = policy_eval["boundary_rule"]

        AuditLedgerService.record_event(
            db=db,
            transaction_id=request.transaction_id,
            event_type=f"POLICY_{block_decision.upper()}",
            actor="Deterministic Policy Gate",
            decision=block_decision,
            reason=block_reason,
            metadata={
                "risk_score": risk_score,
                "action_type": request.action_type,
                "amount_minor": request.amount_minor,
            },
        )

        if txn:
            txn.status = "STOPPED" if block_decision == "Blocked" else "ESCALATED"
            txn.policy = block_decision
            db.commit()

        return RecoveryExecutionResponse(
            transaction_id=request.transaction_id,
            action_type=request.action_type,
            workflow_status="BLOCKED" if block_decision == "Blocked" else "ESCALATED",
            workflow_message=f"Recovery blocked by deterministic policy gate: {block_reason}",
            executed_at=now,
        )

    # 3. Policy Approved: Record RECOVERY_STARTED Audit Event
    AuditLedgerService.record_event(
        db=db,
        transaction_id=request.transaction_id,
        event_type="RECOVERY_STARTED",
        actor="Razorpay Action Orchestrator",
        decision="Approved",
        reason=f"Initiating {request.action_type} under policy authorization.",
        metadata={
            "amount_minor": request.amount_minor,
            "currency": request.currency,
            "risk_score": risk_score,
        },
    )

    try:
        if request.action_type in ("Payment link", "Recovery link", "Hinglish voice recovery", "Call + payment link"):
            result = await RazorpayService.create_payment_link(
                transaction_id=request.transaction_id,
                amount_minor=request.amount_minor,
                currency=request.currency,
            )
            payment_link = result.get("payment_link")
            msg = f"Razorpay Payment Link generated: {payment_link}. Payment pending checkout capture."
        else:
            result = await RazorpayService.create_order(
                transaction_id=request.transaction_id,
                amount_minor=request.amount_minor,
                currency=request.currency,
            )
            order_id = result.get("order_id")
            key_id = result.get("key_id")
            msg = f"Razorpay Test Mode Order {order_id} created. Awaiting captured checkout payment."

        workflow_status = "COMPLETE"

        # Record Action in DB
        action_model = RecoveryActionModel(
            transaction_id=request.transaction_id,
            action_type=request.action_type,
            workflow_status=workflow_status,
            workflow_message=msg,
            executed_at=now,
        )
        db.add(action_model)

        if txn:
            txn.status = "PENDING"
            txn.provider_id = order_id or payment_link
            txn.action = request.action_type

        db.commit()

        # Audit Event
        AuditLedgerService.record_event(
            db=db,
            transaction_id=request.transaction_id,
            event_type="RECOVERY_ACTION_COMPLETED",
            actor="Razorpay Action Orchestrator",
            decision=workflow_status,
            reason=request.action_type,
            metadata={
                "order_id": order_id,
                "payment_link": payment_link,
                "amount_minor": request.amount_minor,
            },
        )

        return RecoveryExecutionResponse(
            transaction_id=request.transaction_id,
            action_type=request.action_type,
            workflow_status=workflow_status,
            workflow_message=msg,
            provider_id=order_id or payment_link,
            order_id=order_id,
            payment_link=payment_link,
            key_id=key_id,
            executed_at=now,
        )

    except Exception as e:
        # Escalate on failure
        AuditLedgerService.record_event(
            db=db,
            transaction_id=request.transaction_id,
            event_type="RECOVERY_ACTION_FAILED",
            actor="Razorpay Action Orchestrator",
            decision="ESCALATED",
            reason=str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Recovery execution failed: {str(e)}",
        )


@router.post("/verify", response_model=PaymentVerificationResponse)
async def verify_payment(
    request: PaymentVerificationRequest,
    db: Session = Depends(get_db),
):
    """
    CRITICAL FINTECH RULE:
    Revenue is marked as RECOVERED ONLY IF Razorpay returns status === 'captured'.
    """
    now = datetime.now(timezone.utc)
    try:
        verification = await RazorpayService.verify_payment(request.payment_id)
        is_verified = verification["verified"]
        pay_status = verification["status"]
        amount_minor = verification.get("amount_minor", request.amount_minor or 249900)

        # Record Verification in DB
        verif_model = PaymentVerificationModel(
            transaction_id=request.transaction_id,
            razorpay_payment_id=request.payment_id,
            amount_minor=amount_minor,
            currency=request.currency,
            status=pay_status,
            verified=is_verified,
            verified_at=now,
        )
        db.add(verif_model)

        # Update Transaction in DB if captured
        txn = db.query(TransactionModel).filter(TransactionModel.id == request.transaction_id).first()
        if txn:
            if is_verified:
                txn.status = "Recovered"
                txn.verified_amount_minor = amount_minor
                txn.provider_id = request.payment_id
            else:
                txn.status = "Pending"
        db.commit()

        # Audit Event
        AuditLedgerService.record_event(
            db=db,
            transaction_id=request.transaction_id,
            event_type="PAYMENT_VERIFIED" if is_verified else "PAYMENT_VERIFICATION_PENDING",
            actor="Razorpay Verification Bridge",
            decision="VERIFIED" if is_verified else "UNVERIFIED",
            reason=f"Razorpay status: {pay_status}",
            metadata={
                "payment_id": request.payment_id,
                "amount_minor": amount_minor,
                "verified": is_verified,
            },
        )

        msg = (
            "Payment captured and verified. Revenue credited to shared recovery ledger."
            if is_verified
            else f"Payment status is '{pay_status}'. Revenue remains pending until captured."
        )

        return PaymentVerificationResponse(
            transaction_id=request.transaction_id,
            payment_id=request.payment_id,
            amount_minor=amount_minor,
            currency=request.currency,
            status=pay_status,
            verified=is_verified,
            verified_at=now,
            message=msg,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Payment verification lookup failed: {str(e)}",
        )

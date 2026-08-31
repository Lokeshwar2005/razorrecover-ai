import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

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
    RecoveryOpportunityModel,
)
from backend.app.schemas.domain import (
    TransactionResponse,
    TransactionCreate,
    PaymentEventIngestRequest,
    PaymentEventIngestResponse,
)
from backend.app.db.seed import seed_canonical_database
from backend.app.services.razorpay.service import RazorpayService
from backend.app.services.audit.ledger import AuditLedgerService

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


SCENARIOS_CATALOG: Dict[str, Dict[str, Any]] = {
    "3ds_timeout": {
        "code": "GATEWAY_ERROR_3DS_TIMEOUT",
        "reason": "3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)",
        "action": "Send payment link",
        "confidence": 94,
        "recovery_probability": 88,
        "risk_score": 15,
        "policy": "Approved",
        "explanation": "Customer encountered a 504 issuer gateway timeout during 3D-Secure challenge. Bounded automated recovery link approved.",
    },
    "low_balance": {
        "code": "BAD_REQUEST_INSUFFICIENT_FUNDS",
        "reason": "Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)",
        "action": "Switch to UPI Auto-Pay / Split Link",
        "confidence": 85,
        "recovery_probability": 72,
        "risk_score": 20,
        "policy": "Approved",
        "explanation": "Soft card limit decline detected. Alternative low-friction UPI Auto-Pay recovery channel recommended.",
    },
    "upi_intent_drop": {
        "code": "UPI_INTENT_TIMEOUT",
        "reason": "UPI Intent Session Expired (Customer Backgrounded App to Check SMS)",
        "action": "Send instant WhatsApp UPI deep link",
        "confidence": 96,
        "recovery_probability": 92,
        "risk_score": 8,
        "policy": "Approved",
        "explanation": "UPI application switch session expired while customer retrieved OTP. Immediate WhatsApp deep link authorized.",
    },
    "bank_downtime": {
        "code": "ISSUER_CBS_DOWN_502",
        "reason": "Issuer Core Banking System (CBS) Scheduled Maintenance / Outage",
        "action": "Smart Routing to Alternate Bank Node",
        "confidence": 91,
        "recovery_probability": 84,
        "risk_score": 12,
        "policy": "Approved",
        "explanation": "502 CBS outage on primary issuer node. Intelligent failover retry routing cleared under policy limits.",
    },
    "risk_engine_flag": {
        "code": "FRAUD_VELOCITY_SOFT_BLOCK",
        "reason": "Issuer Velocity Heuristic Triggered (False Positive Soft Decline)",
        "action": "Dispatch Biometric Verified Secure Link",
        "confidence": 98,
        "recovery_probability": 95,
        "risk_score": 18,
        "policy": "Approved",
        "explanation": "False positive velocity block on legitimate repeat customer. Step-up 3DS2 biometric recovery dispatched.",
    },
    "network_drop": {
        "code": "CLIENT_TCP_CONNECTION_RESET",
        "reason": "Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)",
        "action": "Send 1-Click SMS Recovery Link",
        "confidence": 89,
        "recovery_probability": 81,
        "risk_score": 10,
        "policy": "Approved",
        "explanation": "Client network dropped during gateway handshake. One-click SMS recovery link sent to customer phone.",
    },
    "auth_retries_exceeded": {
        "code": "AUTH_RETRIES_EXCEEDED_3DS",
        "reason": "Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded",
        "action": "Send UPI QR Alternative Link",
        "confidence": 93,
        "recovery_probability": 86,
        "risk_score": 22,
        "policy": "Approved",
        "explanation": "Cardholder exceeded OTP retry limit on card rail. Alternate instant UPI QR link authorized.",
    },
    "cart_abandonment": {
        "code": "GATEWAY_DISMISSED_BY_USER",
        "reason": "Customer Dismissed Razorpay Checkout Window Before Submitting Credentials",
        "action": "Send Cart Recovery WhatsApp with 5% Perk",
        "confidence": 82,
        "recovery_probability": 79,
        "risk_score": 14,
        "policy": "Approved",
        "explanation": "Checkout drawer closed before payment submission. High-intent cart recovery notification triggered.",
    },
}

# Also map uppercase failure codes
for _key, _val in list(SCENARIOS_CATALOG.items()):
    SCENARIOS_CATALOG[_val["code"]] = _val


def resolve_scenario_info(
    scenario_id: Optional[str],
    failure_code: Optional[str],
    failure_reason: Optional[str],
) -> Dict[str, Any]:
    if scenario_id and scenario_id in SCENARIOS_CATALOG:
        return SCENARIOS_CATALOG[scenario_id]
    if failure_code and failure_code in SCENARIOS_CATALOG:
        return SCENARIOS_CATALOG[failure_code]
    
    # Custom or generic failure
    return {
        "code": failure_code or "GATEWAY_PAYMENT_FAILED",
        "reason": failure_reason or "Payment session degraded during gateway authorization.",
        "action": "Send payment link",
        "confidence": 90,
        "recovery_probability": 75,
        "risk_score": 20,
        "policy": "Approved",
        "explanation": f"Payment degraded ({failure_code or 'UNKNOWN'}). Automated safe payment link recovery authorized.",
    }


@router.post("/events", response_model=PaymentEventIngestResponse)
def ingest_payment_event(
    event: PaymentEventIngestRequest,
    db: Session = Depends(get_db),
) -> PaymentEventIngestResponse:
    """
    Authoritative Real-Time Payment Event Ingestion Endpoint.
    Connects Website A (CHRONOVA storefront) to the Canonical Transaction Database,
    instantly triggering the AI diagnosis, policy gate, and recovery pipeline.
    """
    seed_canonical_database(db)
    now = datetime.now(timezone.utc)
    txn_id = event.transaction_id.strip()
    status_lower = (event.status or "failed").lower()
    is_success = status_lower in ("captured", "recovered", "success")

    # 1. Idempotency Check: Look up existing transaction
    existing_txn = db.query(TransactionModel).filter(TransactionModel.id == txn_id).first()

    if existing_txn:
        # If already recovered, return existing state without regression
        if existing_txn.status == "RECOVERED":
            return PaymentEventIngestResponse(
                success=True,
                duplicate=True,
                transaction_id=existing_txn.id,
                status="RECOVERED",
                opportunity_id=f"opp-{existing_txn.id}",
                message=f"Transaction {txn_id} is already verified and recovered.",
                created_at=existing_txn.created_at,
            )

        if is_success:
            # Update existing stopped/pending transaction to RECOVERED
            existing_txn.status = "RECOVERED"
            existing_txn.verified_amount_minor = event.amount_minor
            existing_txn.provider_id = event.payment_id or event.order_id or existing_txn.provider_id
            existing_txn.updated_at = now

            # Ensure PaymentVerificationModel is recorded
            verif = db.query(PaymentVerificationModel).filter(PaymentVerificationModel.transaction_id == txn_id).first()
            if not verif:
                verif = PaymentVerificationModel(
                    transaction_id=txn_id,
                    razorpay_order_id=event.order_id,
                    razorpay_payment_id=event.payment_id or f"pay_{txn_id}",
                    amount_minor=event.amount_minor,
                    currency=event.currency,
                    status="captured",
                    verified=True,
                    verified_at=now,
                )
                db.add(verif)

            AuditLedgerService.record_event(
                db=db,
                transaction_id=txn_id,
                event_type="PAYMENT_VERIFIED",
                actor="Storefront Ingestion Gateway",
                decision="VERIFIED",
                reason="Authoritative direct capture event received from Chronova Storefront.",
                metadata={
                    "payment_id": event.payment_id,
                    "order_id": event.order_id,
                    "amount_minor": event.amount_minor,
                },
            )
            db.commit()

            return PaymentEventIngestResponse(
                success=True,
                duplicate=True,
                transaction_id=existing_txn.id,
                status="RECOVERED",
                opportunity_id=f"opp-{existing_txn.id}",
                message=f"Transaction {txn_id} successfully verified and marked RECOVERED.",
                created_at=existing_txn.created_at,
            )

        # Re-submission of existing failure event — return idempotent confirmation
        opp = db.query(RecoveryOpportunityModel).filter(RecoveryOpportunityModel.transaction_id == txn_id).first()
        return PaymentEventIngestResponse(
            success=True,
            duplicate=True,
            transaction_id=existing_txn.id,
            status=existing_txn.status,
            opportunity_id=opp.id if opp else f"opp-{existing_txn.id}",
            message=f"Transaction event {txn_id} already ingested.",
            created_at=existing_txn.created_at,
        )

    # 2. Ingest New Transaction Event
    scenario_info = resolve_scenario_info(
        scenario_id=event.metadata.scenario_id if event.metadata else None,
        failure_code=event.failure_code,
        failure_reason=event.failure_reason,
    )

    req_source = getattr(event, "source", None) or ("live" if txn_id.startswith("TXN-CN-") else "live")

    if is_success:
        # Create directly recovered transaction
        new_txn = TransactionModel(
            id=txn_id,
            merchant_id=event.merchant_id or "mer_chronova_watches",
            amount_minor=event.amount_minor,
            currency=event.currency.upper(),
            source=req_source,
            status="RECOVERED",
            direction="Direct settlement",
            reason="Payment successful on first attempt",
            action="Direct settlement",
            confidence=99,
            recovery_probability=100,
            risk_score=5,
            policy="Approved",
            explanation=f"Customer successfully authorized ₹{event.amount_minor/100:,.0f} via Razorpay Test Gateway.",
            provider_id=event.payment_id or event.order_id,
            verified_amount_minor=event.amount_minor,
            created_at=now,
            updated_at=now,
        )
        db.add(new_txn)

        verif = PaymentVerificationModel(
            transaction_id=txn_id,
            razorpay_order_id=event.order_id,
            razorpay_payment_id=event.payment_id or f"pay_{txn_id}",
            amount_minor=event.amount_minor,
            currency=event.currency,
            status="captured",
            verified=True,
            verified_at=now,
        )
        db.add(verif)

        AuditLedgerService.record_event(
            db=db,
            transaction_id=txn_id,
            event_type="PAYMENT_CAPTURED",
            actor="Storefront Ingestion Gateway",
            decision="CAPTURED",
            reason="Direct checkout payment authorized.",
            metadata={
                "payment_id": event.payment_id,
                "order_id": event.order_id,
                "amount_minor": event.amount_minor,
                "customer": event.customer.model_dump() if event.customer else None,
            },
        )
        db.commit()

        return PaymentEventIngestResponse(
            success=True,
            transaction_id=txn_id,
            status="RECOVERED",
            opportunity_id=None,
            message=f"Payment {txn_id} successfully captured and recorded.",
            created_at=now,
        )

    # 3. Create Failed Transaction & Run Autonomous Pipeline
    expected_value_minor = int((event.amount_minor * scenario_info["recovery_probability"]) / 100)
    priority = "LOW"
    if expected_value_minor >= 2000000 and scenario_info["policy"] == "Approved":
        priority = "CRITICAL"
    elif expected_value_minor >= 1000000:
        priority = "HIGH"
    elif expected_value_minor >= 400000:
        priority = "MEDIUM"

    new_txn = TransactionModel(
        id=txn_id,
        merchant_id=event.merchant_id or "mer_chronova_watches",
        amount_minor=event.amount_minor,
        currency=event.currency.upper(),
        source=req_source,
        status="STOPPED",
        direction="Payment degradation",
        reason=scenario_info["reason"],
        action=scenario_info["action"],
        confidence=scenario_info["confidence"],
        recovery_probability=scenario_info["recovery_probability"],
        risk_score=scenario_info["risk_score"],
        policy=scenario_info["policy"],
        explanation=scenario_info["explanation"],
        provider_id=event.payment_id or event.order_id,
        verified_amount_minor=0,
        created_at=now,
        updated_at=now,
    )
    db.add(new_txn)

    # Record Failure Event
    raw_payload_dict = {
        "order_id": event.order_id,
        "payment_id": event.payment_id,
        "method": event.method,
        "failure_code": scenario_info["code"],
        "customer": event.customer.model_dump() if event.customer else None,
        "metadata": event.metadata.model_dump() if event.metadata else None,
    }
    failure_event = FailureEventModel(
        transaction_id=txn_id,
        failure_code=scenario_info["code"],
        failure_signature=scenario_info["reason"],
        raw_payload=json.dumps(raw_payload_dict),
        occurred_at=now,
    )
    db.add(failure_event)

    # Record AI Diagnosis
    ai_diag = AIDiagnosisModel(
        transaction_id=txn_id,
        diagnosis=f"Telemetry classification: {scenario_info['reason']}",
        root_cause=scenario_info["reason"],
        recommended_action=scenario_info["action"],
        confidence=scenario_info["confidence"],
        recovery_probability=scenario_info["recovery_probability"],
        priority=priority,
        explanation=scenario_info["explanation"],
        reasoning_factors_json=json.dumps([
            f"Gateway response code: {scenario_info['code']}",
            f"Risk score evaluated at {scenario_info['risk_score']}/100",
            f"Deterministic recovery probability: {scenario_info['recovery_probability']}%",
        ]),
        model_name="razorrecover-deterministic-v3",
        created_at=now,
    )
    db.add(ai_diag)

    # Record Policy Decision
    policy_dec = PolicyDecisionModel(
        transaction_id=txn_id,
        risk_score=scenario_info["risk_score"],
        recovery_probability=scenario_info["recovery_probability"],
        retry_count=1,
        decision=scenario_info["policy"],
        boundary_rule=f"Deterministic rule check: Risk score {scenario_info['risk_score']} <= 70",
        policy_reason="Evaluation confirms safe bounded automated recovery eligibility.",
        execution_allowed=(scenario_info["policy"] == "Approved"),
        evaluated_at=now,
    )
    db.add(policy_dec)

    # Record Recovery Opportunity
    opp_id = f"opp-{txn_id}"
    recovery_opp = RecoveryOpportunityModel(
        id=opp_id,
        transaction_id=txn_id,
        amount_minor=event.amount_minor,
        recovery_probability=scenario_info["recovery_probability"],
        expected_value_minor=expected_value_minor,
        priority=priority,
        recommended_action=scenario_info["action"],
        policy_status=scenario_info["policy"],
        created_at=now,
    )
    db.add(recovery_opp)

    # Record Audit Events with Cryptographic Chaining
    AuditLedgerService.record_event(
        db=db,
        transaction_id=txn_id,
        event_type="FAILURE_EVENT_INGESTED",
        actor="Storefront Ingestion Gateway",
        decision="STOPPED",
        reason=scenario_info["reason"],
        metadata={
            "code": scenario_info["code"],
            "amount_minor": event.amount_minor,
            "currency": event.currency,
            "order_id": event.order_id,
        },
    )
    AuditLedgerService.record_event(
        db=db,
        transaction_id=txn_id,
        event_type="AI_DIAGNOSIS_CREATED",
        actor="AI Agent (razorrecover-v3)",
        decision="Approved",
        reason=scenario_info["reason"],
        metadata={
            "confidence": scenario_info["confidence"],
            "recovery_probability": scenario_info["recovery_probability"],
            "recommended_action": scenario_info["action"],
        },
    )
    AuditLedgerService.record_event(
        db=db,
        transaction_id=txn_id,
        event_type="POLICY_APPROVED",
        actor="Deterministic Policy Gate",
        decision="Approved",
        reason=f"Risk score {scenario_info['risk_score']} <= 70",
        metadata={"execution_allowed": True},
    )

    # Populate 8 Explainable Agent Trace Steps
    traces = [
        (0, "Ingestion & Telemetry", "DONE", f"Ingested {scenario_info['code']} from Chronova storefront.", "Telemetry validated", "INGESTED"),
        (1, "Failure Classification", "DONE", f"Signature: {scenario_info['reason']}", "Classified root cause", "CLASSIFIED"),
        (2, "AI Root Cause Analysis", "DONE", f"Confidence: {scenario_info['confidence']}%, Prob: {scenario_info['recovery_probability']}%", "Diagnosis completed", "DIAGNOSED"),
        (3, "Strategy Candidate Evaluation", "DONE", f"Candidate action: {scenario_info['action']}", "Strategy optimized", "OPTIMIZED"),
        (4, "Deterministic Policy Gate", "DONE", f"Risk score: {scenario_info['risk_score']}/100", "Policy cleared", "APPROVED"),
        (5, "Execution Orchestration", "WAIT", f"Ready to orchestrate {scenario_info['action']}", "Awaiting operator trigger", "READY"),
        (6, "Customer Interaction Bridge", "WAIT", f"Target destination: {event.customer.phone if event.customer else 'Customer channel'}", "Pending recovery dispatch", "PENDING"),
        (7, "Cryptographic Ledger Verification", "WAIT", f"Expected recovery: ₹{event.amount_minor/100:,.0f}", "Awaiting settlement verification", "UNVERIFIED"),
    ]
    for idx, name, trace_status, in_sum, out_sum, dec in traces:
        db.add(AgentTraceModel(
            transaction_id=txn_id,
            stage_index=idx,
            stage_name=name,
            status=trace_status,
            input_summary=in_sum,
            output_summary=out_sum,
            decision=dec,
            detail=f"{name} — {out_sum} [{scenario_info['code']}].",
            recorded_at=now,
        ))

    db.commit()

    return PaymentEventIngestResponse(
        success=True,
        transaction_id=txn_id,
        status="STOPPED",
        opportunity_id=opp_id,
        message=f"Payment failure event {txn_id} ingested into canonical ledger. Opportunity {opp_id} created.",
        created_at=now,
    )


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

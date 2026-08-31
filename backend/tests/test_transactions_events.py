import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import get_db, SessionLocal
from backend.app.db.models import (
    TransactionModel,
    FailureEventModel,
    AIDiagnosisModel,
    PolicyDecisionModel,
    RecoveryOpportunityModel,
    AuditEventModel,
    AgentTraceModel,
    PaymentVerificationModel,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    db_session = SessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()


def test_all_8_failure_scenarios_ingestion(client, db):
    """
    Test that all 8 distinct failure scenarios from Chronova (Website A)
    are ingested properly into the backend canonical database.
    """
    scenarios = [
        ("3ds_timeout", "GATEWAY_ERROR_3DS_TIMEOUT", "3DS Authentication Bank Gateway Timeout (Issuer Switch Unresponsive)", "Send payment link"),
        ("low_balance", "BAD_REQUEST_INSUFFICIENT_FUNDS", "Insufficient Funds / Account Credit Limit Exhausted (Soft Decline)", "Switch to UPI Auto-Pay / Split Link"),
        ("upi_intent_drop", "UPI_INTENT_TIMEOUT", "UPI Intent Session Expired (Customer Backgrounded App to Check SMS)", "Send instant WhatsApp UPI deep link"),
        ("bank_downtime", "ISSUER_CBS_DOWN_502", "Issuer Core Banking System (CBS) Scheduled Maintenance / Outage", "Smart Routing to Alternate Bank Node"),
        ("risk_engine_flag", "FRAUD_VELOCITY_SOFT_BLOCK", "Issuer Velocity Heuristic Triggered (False Positive Soft Decline)", "Dispatch Biometric Verified Secure Link"),
        ("network_drop", "CLIENT_TCP_CONNECTION_RESET", "Client TCP Connection Reset During 3D-Secure Handshake (Network Flap)", "Send 1-Click SMS Recovery Link"),
        ("auth_retries_exceeded", "AUTH_RETRIES_EXCEEDED_3DS", "Cardholder Entered Incorrect OTP / 3DS Verification Retries Exceeded", "Send UPI QR Alternative Link"),
        ("cart_abandonment", "GATEWAY_DISMISSED_BY_USER", "Customer Dismissed Razorpay Checkout Window Before Submitting Credentials", "Send Cart Recovery WhatsApp with 5% Perk"),
    ]

    for scenario_id, code, expected_reason, expected_action in scenarios:
        txn_id = f"TXN-TEST-SCENARIO-{scenario_id.upper()}"
        payload = {
            "transaction_id": txn_id,
            "merchant_id": "mer_chronova_watches",
            "order_id": f"order_{scenario_id}",
            "amount_minor": 499500,
            "currency": "INR",
            "status": "failed",
            "provider": "razorpay",
            "method": "card",
            "failure_code": code,
            "failure_reason": expected_reason,
            "customer": {
                "name": "Lokeshwar Sudam",
                "email": "lokeshwar@example.com",
                "phone": "+91 98765 43210",
            },
            "metadata": {
                "product_id": "chronova-001",
                "product_name": "Titan Edge Silver Dial",
                "brand": "Titan",
                "scenario_id": scenario_id,
            },
        }

        res = client.post("/api/v1/transactions/events", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["transaction_id"] == txn_id
        assert data["status"] == "STOPPED"
        assert data["opportunity_id"] == f"opp-{txn_id}"

        # Verify DB records
        txn = db.query(TransactionModel).filter(TransactionModel.id == txn_id).first()
        assert txn is not None
        assert txn.status == "STOPPED"
        assert txn.amount_minor == 499500
        assert txn.reason == expected_reason
        assert txn.action == expected_action
        assert txn.policy == "Approved"

        # Verify FailureEventModel
        fe = db.query(FailureEventModel).filter(FailureEventModel.transaction_id == txn_id).first()
        assert fe is not None
        assert fe.failure_code == code

        # Verify AIDiagnosisModel
        diag = db.query(AIDiagnosisModel).filter(AIDiagnosisModel.transaction_id == txn_id).first()
        assert diag is not None
        assert diag.recommended_action == expected_action

        # Verify RecoveryOpportunityModel
        opp = db.query(RecoveryOpportunityModel).filter(RecoveryOpportunityModel.transaction_id == txn_id).first()
        assert opp is not None
        assert opp.recommended_action == expected_action
        assert opp.policy_status == "Approved"

        # Verify AgentTraceModel has 8 steps
        traces = db.query(AgentTraceModel).filter(AgentTraceModel.transaction_id == txn_id).all()
        assert len(traces) == 8


def test_idempotency_duplicate_events(client, db):
    """
    Submitting the same transaction event 5 times must NOT duplicate transactions in the database.
    """
    txn_id = "TXN-TEST-IDEMPOTENT-001"
    payload = {
        "transaction_id": txn_id,
        "merchant_id": "mer_chronova_watches",
        "order_id": "order_idempotent",
        "amount_minor": 750000,
        "currency": "INR",
        "status": "failed",
        "failure_code": "GATEWAY_ERROR_3DS_TIMEOUT",
        "customer": {"email": "test@example.com"},
    }

    # Ingest 5 times
    for _ in range(5):
        res = client.post("/api/v1/transactions/events", json=payload)
        assert res.status_code == 200

    # Assert exactly 1 record in DB
    matching_txns = db.query(TransactionModel).filter(TransactionModel.id == txn_id).all()
    assert len(matching_txns) == 1

    matching_opps = db.query(RecoveryOpportunityModel).filter(RecoveryOpportunityModel.transaction_id == txn_id).all()
    assert len(matching_opps) == 1


def test_successful_checkout_event(client, db):
    """
    Test direct successful payment capture event from Chronova Storefront.
    """
    txn_id = "TXN-TEST-SUCCESS-001"
    payment_id = "pay_test_direct_capture_123"
    payload = {
        "transaction_id": txn_id,
        "merchant_id": "mer_chronova_watches",
        "order_id": "order_success_123",
        "payment_id": payment_id,
        "amount_minor": 1250000,
        "currency": "INR",
        "status": "captured",
        "provider": "razorpay",
        "method": "upi",
    }

    res = client.post("/api/v1/transactions/events", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "RECOVERED"

    txn = db.query(TransactionModel).filter(TransactionModel.id == txn_id).first()
    assert txn is not None
    assert txn.status == "RECOVERED"
    assert txn.verified_amount_minor == 1250000

    verif = db.query(PaymentVerificationModel).filter(PaymentVerificationModel.transaction_id == txn_id).first()
    assert verif is not None
    assert verif.verified is True
    assert verif.status == "captured"


def test_end_to_end_recovery_and_verification_flow(client, db):
    """
    Test full lifecycle:
    1. Ingest Failure Event from Website A
    2. Website B reads opportunity & executes recovery
    3. Customer settles payment & Backend verifies it
    4. Website A polls detail and observes RECOVERED
    """
    import uuid
    uid = uuid.uuid4().hex[:8].upper()
    txn_id = f"TXN-TEST-E2E-{uid}"
    order_id = f"order_e2e_{uid}"
    amount_minor = 899500

    # 1. Storefront failure ingestion
    fail_res = client.post("/api/v1/transactions/events", json={
        "transaction_id": txn_id,
        "merchant_id": "mer_chronova_watches",
        "order_id": order_id,
        "amount_minor": amount_minor,
        "currency": "INR",
        "status": "failed",
        "failure_code": "GATEWAY_ERROR_3DS_TIMEOUT",
        "metadata": {"scenario_id": "3ds_timeout"},
    })
    assert fail_res.status_code == 200
    assert fail_res.json()["status"] == "STOPPED"

    # 2. Website B executes recovery
    exec_res = client.post("/api/v1/recovery/execute", json={
        "transaction_id": txn_id,
        "action_type": "Send payment link",
        "amount_minor": amount_minor,
        "currency": "INR",
    })
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["workflow_status"] == "COMPLETE"
    assert "recovery_operation_id" in exec_data

    # Verify transaction is still unrecovered before payment capture (Invariant)
    detail_before = client.get(f"/api/v1/transactions/{txn_id}").json()
    assert detail_before["transaction"]["status"] != "RECOVERED"

    # 3. Verification of capture
    verif_res = client.post("/api/v1/recovery/verify", json={
        "transaction_id": txn_id,
        "payment_id": f"pay_test_capture_verified_{uid}",
        "order_id": order_id,
        "amount_minor": amount_minor,
        "currency": "INR",
    })
    assert verif_res.status_code == 200
    verif_data = verif_res.json()
    assert verif_data["verified"] is True
    assert verif_data["status"] == "captured"

    # 4. Website A polls detail endpoint and receives RECOVERED
    detail_after = client.get(f"/api/v1/transactions/{txn_id}").json()
    assert detail_after["transaction"]["status"] == "RECOVERED"
    assert detail_after["transaction"]["verified_amount_minor"] == amount_minor


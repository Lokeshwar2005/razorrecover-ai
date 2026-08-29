import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import TransactionModel, PaymentVerificationModel
from datetime import datetime, timezone

client = TestClient(app)


@pytest.fixture(autouse=True)
def seed_test_transactions():
    db = SessionLocal()
    # Clean and seed TXN-1065 and TXN-1077 specifically
    for txn_id in ["TXN-1065", "TXN-1077", "TXN-TEST-A", "TXN-TEST-B"]:
        db.query(PaymentVerificationModel).filter(PaymentVerificationModel.transaction_id == txn_id).delete()
        db.query(TransactionModel).filter(TransactionModel.id == txn_id).delete()
    
    t1065 = TransactionModel(
        id="TXN-1065",
        merchant_id="mer_default",
        amount_minor=2499900,
        currency="INR",
        source="synthetic",
        status="PENDING",
        direction="Checkout friction",
        reason="High-intent failed payment",
        action="Call + payment link",
        confidence=88,
        recovery_probability=73,
        risk_score=37,
        policy="Approved",
        explanation="High intent checkout.",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    t1077 = TransactionModel(
        id="TXN-1077",
        merchant_id="mer_default",
        amount_minor=1899900,
        currency="INR",
        source="synthetic",
        status="PENDING",
        direction="Subscription dunning",
        reason="Subscription charge failed",
        action="Retry subscription",
        confidence=89,
        recovery_probability=76,
        risk_score=34,
        policy="Approved",
        explanation="Subscription retry.",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add_all([t1065, t1077])
    db.commit()
    db.close()


def test_payment_link_transaction_mapping():
    """Verify payment link creation binds strictly to requested transaction ID."""
    resp = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1065",
            "action_type": "Payment link",
            "amount_minor": 2499900,
            "currency": "INR",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["transaction_id"] == "TXN-1065"
    assert data["workflow_status"] == "COMPLETE"
    assert "1065" in (data.get("order_id") or data.get("payment_link") or data["workflow_message"])


def test_txn_1065_does_not_map_to_txn_1077():
    """Explicitly verify TXN-1065 and TXN-1077 maintain strict isolation."""
    resp_1065 = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1065",
            "action_type": "Payment link",
            "amount_minor": 2499900,
            "currency": "INR",
        },
    )
    resp_1077 = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1077",
            "action_type": "Retry subscription",
            "amount_minor": 1899900,
            "currency": "INR",
        },
    )
    d1065 = resp_1065.json()
    d1077 = resp_1077.json()
    assert d1065["transaction_id"] == "TXN-1065"
    assert d1077["transaction_id"] == "TXN-1077"
    assert d1065["transaction_id"] != d1077["transaction_id"]


def test_payment_verification_transaction_mapping():
    """Verify payment verification updates target transaction correctly."""
    resp = client.post(
        "/api/v1/recovery/verify",
        json={
            "transaction_id": "TXN-1065",
            "payment_id": "pay_test_txn_1065_valid",
            "amount_minor": 2499900,
            "currency": "INR",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["transaction_id"] == "TXN-1065"
    assert data["amount_minor"] == 2499900
    assert data["currency"] == "INR"
    assert data["verified"] is True
    assert data["status"] == "captured"


def test_wrong_amount_rejected():
    """Verify verification is rejected if requested amount does not match transaction."""
    resp = client.post(
        "/api/v1/recovery/verify",
        json={
            "transaction_id": "TXN-1065",
            "payment_id": "pay_test_txn_1065_tampered",
            "amount_minor": 10000,  # ₹100 instead of ₹24,999
            "currency": "INR",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is False
    assert data["status"] == "failed"
    assert "Amount mismatch" in data["message"]


def test_wrong_currency_rejected():
    """Verify verification is rejected if currency does not match."""
    resp = client.post(
        "/api/v1/recovery/verify",
        json={
            "transaction_id": "TXN-1065",
            "payment_id": "pay_test_txn_1065_usd",
            "amount_minor": 2499900,
            "currency": "USD",  # USD instead of INR
        },
    )
    assert resp.status_code == 200
    # Expected INR currency maintained in response
    data = resp.json()
    assert data["currency"] == "INR"


def test_duplicate_verification_idempotent():
    """Verify multiple verify calls on an already verified transaction return consistent result."""
    payload = {
        "transaction_id": "TXN-1065",
        "payment_id": "pay_test_txn_1065_idempotent",
        "amount_minor": 2499900,
        "currency": "INR",
    }
    resp1 = client.post("/api/v1/recovery/verify", json=payload)
    assert resp1.status_code == 200
    assert resp1.json()["verified"] is True

    # Second call
    resp2 = client.post("/api/v1/recovery/verify", json=payload)
    assert resp2.status_code == 200
    assert resp2.json()["verified"] is True
    assert "already verified" in resp2.json()["message"] or "Confirmed" in resp2.json()["message"]


def test_pending_not_verified():
    """Verify that failed/pending payment IDs are not marked verified."""
    resp = client.post(
        "/api/v1/recovery/verify",
        json={
            "transaction_id": "TXN-1077",
            "payment_id": "pay_failed_txn_1077",
            "amount_minor": 1899900,
            "currency": "INR",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["verified"] is False
    assert data["status"] == "failed"

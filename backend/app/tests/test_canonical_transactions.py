import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import TransactionModel

client = TestClient(app)


@pytest.fixture(autouse=True)
def ensure_clean_canonical_db():
    db = SessionLocal()
    from backend.app.services.recovery.engine import create_synthetic_transaction
    db.query(TransactionModel).delete()
    for i in range(100):
        txn_dict = create_synthetic_transaction(i, "balanced")
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
    db.close()


def test_canonical_dataset_contains_100_synthetic_transactions():
    """Verify backend transaction API seeds and serves 100 canonical synthetic transactions."""
    resp = client.get("/api/v1/transactions?limit=200")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 100


def test_txn_1033_exists_in_canonical_dataset():
    """Verify that TXN-1033 exists and can be retrieved directly."""
    resp = client.get("/api/v1/transactions/TXN-1033")
    assert resp.status_code == 200
    data = resp.json()
    txn = data.get("transaction")
    assert txn["id"] == "TXN-1033"
    assert txn["currency"] == "INR"
    assert txn["source"] == "synthetic"


def test_search_1033_returns_txn_1033():
    """Verify search '1033' finds TXN-1033."""
    resp = client.get("/api/v1/transactions?search=1033")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    ids = [t["id"] for t in data]
    assert "TXN-1033" in ids


def test_search_case_insensitive():
    """Verify search is case-insensitive for txn-1033 and TXN-1033."""
    resp_lower = client.get("/api/v1/transactions?search=txn-1033")
    assert resp_lower.status_code == 200
    ids_lower = [t["id"] for t in resp_lower.json()]
    assert "TXN-1033" in ids_lower

    resp_upper = client.get("/api/v1/transactions?search=TXN-1033")
    assert resp_upper.status_code == 200
    ids_upper = [t["id"] for t in resp_upper.json()]
    assert "TXN-1033" in ids_upper


def test_search_by_failure_reason_and_action():
    """Verify search matches across reasons and actions."""
    resp = client.get("/api/v1/transactions?search=timeout")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    for t in data:
        assert "timeout" in t["reason"].lower() or "timeout" in t["action"].lower() or "timeout" in t["id"].lower()


def test_filters_work_across_all_records():
    """Verify status and risk filters operate accurately."""
    resp_pending = client.get("/api/v1/transactions?filter_type=pending&limit=200")
    assert resp_pending.status_code == 200
    for t in resp_pending.json():
        assert t["status"].upper() == "PENDING"

    resp_high_risk = client.get("/api/v1/transactions?filter_type=high_risk&limit=200")
    assert resp_high_risk.status_code == 200
    for t in resp_high_risk.json():
        assert t["risk_score"] >= 60


def test_pagination_preserves_canonical_continuity():
    """Verify pagination slicing works accurately without changing dataset continuity."""
    resp_p1 = client.get("/api/v1/transactions?limit=20&offset=0")
    assert resp_p1.status_code == 200
    p1 = resp_p1.json()
    assert len(p1) == 20

    resp_p2 = client.get("/api/v1/transactions?limit=20&offset=20")
    assert resp_p2.status_code == 200
    p2 = resp_p2.json()
    assert len(p2) == 20

    # Ensure no overlap between page 1 and page 2
    p1_ids = {t["id"] for t in p1}
    p2_ids = {t["id"] for t in p2}
    assert len(p1_ids.intersection(p2_ids)) == 0


def test_opportunities_engine_contains_txn_1033():
    """Verify recovery opportunities can look up and rank TXN-1033."""
    resp = client.get("/api/v1/opportunities/opp-TXN-1033")
    assert resp.status_code == 200
    data = resp.json()
    assert data["transaction_id"] == "TXN-1033"
    assert data["expected_recovery_value_minor"] > 0


def test_razorpay_payments_feed_endpoint():
    """Verify GET /api/v1/recovery/razorpay/payments returns normalized provider feed."""
    resp = client.get("/api/v1/recovery/razorpay/payments")
    assert resp.status_code == 200
    data = resp.json()
    assert data["provider"] == "razorpay"
    assert data["count"] >= 3
    items = data["items"]
    ids = [p["id"] for p in items]
    assert "pay_TVWRbgbZZuldtX" in ids
    assert "pay_TVKcFPdvHDKIPQ" in ids
    assert "pay_TVKaknokzpndeV" in ids


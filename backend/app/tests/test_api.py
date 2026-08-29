import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.models import Base
from backend.app.db.session import get_db
from backend.app.main import app


@pytest.fixture
def client():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_health_endpoint(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "RazorRecover AI 2.0" in data["service"]


def test_transactions_endpoint(client):
    res = client.get("/api/v1/transactions?scenario=balanced&limit=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 100  # Seeds initial 100 events
    assert data[0]["currency"] == "INR"
    assert data[0]["amount_minor"] > 0


def test_policy_evaluate_endpoint(client):
    payload = {
        "transaction_id": "TXN-TEST-1",
        "amount_minor": 249900,
        "reason": "Network degradation",
        "risk_score": 28,
        "recovery_probability": 80,
        "retry_count": 1,
        "action": "Retry payment",
        "policy_threshold": 70,
    }
    res = client.post("/api/v1/recovery/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["decision"] == "Approved"
    assert data["execution_allowed"] is True


def test_recovery_execute_endpoint(client):
    payload = {
        "transaction_id": "TXN-TEST-EXEC",
        "action_type": "Retry payment",
        "amount_minor": 249900,
        "currency": "INR",
    }
    res = client.post("/api/v1/recovery/execute", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["workflow_status"] == "COMPLETE"
    assert data["order_id"] is not None


def test_payment_verify_endpoint(client):
    payload = {
        "transaction_id": "TXN-TEST-VERIFY",
        "payment_id": "pay_test_captured_123",
        "amount_minor": 249900,
        "currency": "INR",
    }
    res = client.post("/api/v1/recovery/verify", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["verified"] is True
    assert data["status"] == "captured"


def test_counterfactual_evaluate_endpoint(client):
    payload = {
        "original_transaction_id": "TXN-1001",
        "amount_minor": 499900,
        "reason": "Bank timeout",
        "risk_score": 85,  # Trigger escalate
        "recovery_probability": 45,
        "retry_attempts": 3,
        "policy_threshold": 70,
    }
    res = client.post("/api/v1/counterfactual/evaluate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["counterfactual_decision"] == "Escalated"
    assert data["counterfactual_result"] == "Stopped"
    assert len(data["deltas"]) > 0


def test_audit_trail_endpoint(client):
    # First evaluate to generate audit event
    client.post("/api/v1/recovery/evaluate", json={
        "transaction_id": "TXN-AUDIT-1",
        "amount_minor": 249900,
        "reason": "Bank timeout",
        "risk_score": 25,
        "recovery_probability": 80,
        "retry_count": 1,
        "action": "Retry payment",
        "policy_threshold": 70,
    })

    res = client.get("/api/v1/audit/TXN-AUDIT-1")
    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 1
    assert events[0]["event_hash"] is not None

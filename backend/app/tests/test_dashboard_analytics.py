import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.db.models import Base, TransactionModel
from backend.app.db.session import get_db


@pytest.fixture
def client():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    db = TestingSessionLocal()
    t1 = TransactionModel(
        id="TXN-DASH-1",
        amount_minor=1000000,
        reason="Network timeout",
        action="Retry payment",
        status="RECOVERED",
        verified_amount_minor=1000000,
        policy="Approved",
        risk_score=20,
        recovery_probability=85,
    )
    t2 = TransactionModel(
        id="TXN-DASH-2",
        amount_minor=2000000,
        reason="Checkout drop-off",
        action="Payment link",
        status="PENDING",
        verified_amount_minor=0,
        policy="Approved",
        risk_score=30,
        recovery_probability=75,
    )
    t3 = TransactionModel(
        id="TXN-DASH-3",
        amount_minor=5000000,
        reason="Stolen card",
        action="Retry payment",
        status="STOPPED",
        verified_amount_minor=0,
        policy="Escalated",
        risk_score=85,
        recovery_probability=30,
    )
    db.add_all([t1, t2, t3])
    db.commit()
    db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_dashboard_stats_endpoint(client):
    response = client.get("/api/v1/dashboard/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["revenue_at_risk_minor"] == 8000000  # 10k + 20k + 50k
    assert data["revenue_recovered_minor"] == 1000000  # 10k
    assert data["failed_transactions_count"] == 1
    assert data["active_recovery_attempts_count"] == 1
    assert data["policy_blocks_count"] == 1
    assert len(data["trends"]) == 7


def test_analytics_recovery_endpoint(client):
    response = client.get("/api/v1/analytics/recovery")
    assert response.status_code == 200
    data = response.json()
    assert data["total_revenue_at_risk_minor"] == 8000000
    assert data["total_revenue_recovered_minor"] == 1000000
    assert len(data["action_performance"]) >= 2
    assert len(data["failure_distributions"]) >= 2


def test_opportunities_endpoint(client):
    response = client.get("/api/v1/opportunities")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["transaction_id"] == "TXN-DASH-2"
    assert data[0]["expected_value_minor"] == 1500000  # 2,000,000 * 75%

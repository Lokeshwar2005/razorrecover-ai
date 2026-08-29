import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.db.models import Base
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


def test_get_policy_settings_default(client):
    response = client.get("/api/v1/settings/policies")
    assert response.status_code == 200
    data = response.json()
    assert data["max_risk_ceiling"] == 70
    assert data["max_retry_ceiling"] == 2
    assert data["min_recovery_probability"] == 55


def test_update_policy_settings_valid(client):
    payload = {
        "max_risk_ceiling": 65,
        "max_retry_ceiling": 3,
        "min_recovery_probability": 60,
        "allow_retry_payment": True,
        "allow_payment_link": True,
        "allow_customer_prompt": False,
        "allow_voice_recovery": True,
        "allow_ptp_tracker": True,
    }
    response = client.put("/api/v1/settings/policies", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["max_risk_ceiling"] == 65
    assert data["allow_customer_prompt"] is False


def test_update_policy_settings_invalid_risk_ceiling(client):
    payload = {
        "max_risk_ceiling": 99,  # exceeds max allowed
        "max_retry_ceiling": 2,
        "min_recovery_probability": 55,
        "allow_retry_payment": True,
        "allow_payment_link": True,
        "allow_customer_prompt": True,
        "allow_voice_recovery": True,
        "allow_ptp_tracker": True,
    }
    response = client.put("/api/v1/settings/policies", json=payload)
    assert response.status_code in (400, 422)

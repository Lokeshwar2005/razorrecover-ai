import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_execute_recovery_creates_canonical_recovery_operation_id():
    response = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1033",
            "action_type": "Retry payment",
            "amount_minor": 150000,
            "currency": "INR",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "TXN-1033"
    assert data["workflow_status"] in ("COMPLETE", "READY")
    assert "recovery_operation_id" in data
    assert data["recovery_operation_id"] is not None
    assert data["recovery_operation_id"].startswith("REC-")
    assert "TXN1033" in data["recovery_operation_id"] or "1033" in data["recovery_operation_id"]

def test_execute_recovery_preserves_supplied_recovery_operation_id():
    custom_op_id = "REC-20260830-CUSTOM-0001"
    response = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1034",
            "action_type": "Payment link",
            "amount_minor": 250000,
            "currency": "INR",
            "recovery_operation_id": custom_op_id,
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["recovery_operation_id"] == custom_op_id

def test_execute_recovery_razorpay_test_transaction():
    response = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "RZP-pay_TVKaknokzpndeV",
            "action_type": "Retry payment",
            "amount_minor": 76800,
            "currency": "INR",
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["transaction_id"] == "RZP-pay_TVKaknokzpndeV"
    assert data["recovery_operation_id"] is not None
    assert data["recovery_operation_id"].startswith("REC-")

def test_recovery_lifecycle_audit_trail_records_operation_id():
    op_id = "REC-20260830-AUDIT-TEST"
    exec_res = client.post(
        "/api/v1/recovery/execute",
        json={
            "transaction_id": "TXN-1035",
            "action_type": "Retry payment",
            "amount_minor": 120000,
            "currency": "INR",
            "recovery_operation_id": op_id,
        }
    )
    assert exec_res.status_code == 200

    audit_res = client.get("/api/v1/audit/TXN-1035")
    assert audit_res.status_code == 200
    events = audit_res.json()
    assert len(events) > 0
    assert any(e.get("transaction_id") == "TXN-1035" for e in events)

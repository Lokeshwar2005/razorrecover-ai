import pytest
from backend.app.schemas.domain import CounterfactualRequest
from backend.app.services.recovery.counterfactual import CounterfactualService


def test_counterfactual_flips_approved_to_escalated():
    orig_txn = {
        "id": "TXN-1042",
        "amount_minor": 249900,
        "reason": "Network degradation",
        "risk_score": 28,
        "recovery_probability": 82,
        "policy": "Approved",
        "result": "Recovered",
    }

    req = CounterfactualRequest(
        original_transaction_id="TXN-1042",
        amount_minor=249900,
        reason="Network degradation",
        risk_score=78,  # Mutated above 70 threshold
        recovery_probability=82,
        retry_attempts=1,
        policy_threshold=70,
    )

    res = CounterfactualService.evaluate(orig_txn, req)
    assert res.original_decision == "Approved"
    assert res.counterfactual_decision == "Escalated"
    assert res.outcome_flipped is True
    assert "FLIPPED from APPROVED ➔ ESCALATED" in res.explanation

    # Verify original transaction was NOT mutated
    assert orig_txn["risk_score"] == 28
    assert orig_txn["policy"] == "Approved"


def test_counterfactual_flips_escalated_to_approved():
    orig_txn = {
        "id": "TXN-1055",
        "amount_minor": 499900,
        "reason": "Issuer unavailable",
        "risk_score": 75,
        "recovery_probability": 80,
        "policy": "Escalated",
        "result": "Stopped",
    }

    req = CounterfactualRequest(
        original_transaction_id="TXN-1055",
        amount_minor=499900,
        reason="Issuer unavailable",
        risk_score=35,  # Lowered risk
        recovery_probability=80,
        retry_attempts=1,
        policy_threshold=70,
    )

    res = CounterfactualService.evaluate(orig_txn, req)
    assert res.original_decision == "Escalated"
    assert res.counterfactual_decision == "Approved"
    assert res.outcome_flipped is True
    assert "FLIPPED from ESCALATED ➔ APPROVED" in res.explanation

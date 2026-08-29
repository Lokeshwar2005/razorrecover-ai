import pytest
from backend.app.services.policy.engine import DeterministicPolicyEngine


def test_policy_engine_approves_safe_transaction():
    result = DeterministicPolicyEngine.evaluate(
        risk_score=28,
        recovery_probability=82,
        retry_count=1,
        action="Retry payment",
        policy_threshold=70,
    )
    assert result["decision"] == "Approved"
    assert result["result"] == "Recovered"
    assert result["execution_allowed"] is True
    assert result["action"] == "Retry payment"


def test_policy_engine_blocks_high_risk_transaction():
    result = DeterministicPolicyEngine.evaluate(
        risk_score=75,
        recovery_probability=85,
        retry_count=1,
        action="Retry payment",
        policy_threshold=70,
    )
    assert result["decision"] == "Escalated"
    assert result["result"] == "Stopped"
    assert result["execution_allowed"] is False
    assert "Risk score ceiling exceeded" in result["boundary_rule"]


def test_policy_engine_blocks_retry_ceiling_crossed():
    result = DeterministicPolicyEngine.evaluate(
        risk_score=20,
        recovery_probability=90,
        retry_count=3,  # > 2 maximum automated retries
        action="Retry payment",
        policy_threshold=70,
    )
    assert result["decision"] == "Escalated"
    assert result["result"] == "Stopped"
    assert result["execution_allowed"] is False
    assert "Retry count limit crossed" in result["boundary_rule"]


def test_policy_engine_escalates_low_probability():
    result = DeterministicPolicyEngine.evaluate(
        risk_score=30,
        recovery_probability=40,  # < 55%
        retry_count=1,
        action="Retry payment",
        policy_threshold=70,
    )
    assert result["decision"] == "Escalated"
    assert result["result"] == "Stopped"
    assert result["execution_allowed"] is False
    assert "economic threshold" in result["boundary_rule"]


def test_policy_engine_normalizes_unknown_action():
    result = DeterministicPolicyEngine.evaluate(
        risk_score=25,
        recovery_probability=80,
        retry_count=1,
        action="Hack account balance",  # Unsupported/unsafe action
        policy_threshold=70,
    )
    assert result["decision"] == "Approved"
    assert result["action"] == "Retry payment"
    assert "Standard fallback action applied" in result["boundary_rule"]

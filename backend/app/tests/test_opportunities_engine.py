import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.opportunities.scoring import OpportunityScoringEngine
from backend.app.services.opportunities.service import OpportunityService

client = TestClient(app)


def test_expected_recovery_value_exact_math():
    # ₹45,000 (4500000 paise) * 82% = ₹36,900 (3690000 paise)
    ev = OpportunityScoringEngine.calculate_expected_recovery_value(4500000, 82)
    assert ev == 3690000

    # ₹18,500 (1850000 paise) * 76% = ₹14,060 (1406000 paise)
    ev2 = OpportunityScoringEngine.calculate_expected_recovery_value(1850000, 76)
    assert ev2 == 1406000

    # Zero amount
    assert OpportunityScoringEngine.calculate_expected_recovery_value(0, 80) == 0

    # Negative amount protection
    assert OpportunityScoringEngine.calculate_expected_recovery_value(-500000, 80) == 0

    # Probability clamping
    assert OpportunityScoringEngine.calculate_expected_recovery_value(1000000, 150) == 1000000
    assert OpportunityScoringEngine.calculate_expected_recovery_value(1000000, -20) == 0


def test_priority_score_and_levels():
    # Critical: High EV (₹40,000), high prob (85%), low risk (20)
    score, level = OpportunityScoringEngine.calculate_priority_score(
        expected_value_minor=4000000,
        recovery_probability=85,
        risk_score=20,
        policy_eligible=True,
    )
    assert level in ["CRITICAL", "HIGH"]
    assert score >= 60

    # Blocked policy applies heavy penalty
    score_blocked, level_blocked = OpportunityScoringEngine.calculate_priority_score(
        expected_value_minor=4000000,
        recovery_probability=85,
        risk_score=85,
        policy_eligible=False,
    )
    assert score_blocked < score


def test_explainability_generation():
    expl = OpportunityScoringEngine.generate_explainability(
        amount_minor=4500000,
        expected_value_minor=3690000,
        recovery_probability=82,
        risk_score=28,
        failure_signature="Checkout abandoned",
        recommended_action="Payment link",
        policy_status="Approved",
        policy_reason="Authorized by deterministic policy gate (Risk 28 < 70 ceiling).",
    )
    assert "₹36,900" in expl.why_priority or "Critical" in expl.why_priority or "High" in expl.why_priority
    assert "Payment Link" in expl.why_action or "Smart Payment Link" in expl.why_action
    assert "Authorized" in expl.why_policy_status


def test_api_list_opportunities():
    resp = client.get("/api/v1/opportunities?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if len(data) > 0:
        item = data[0]
        assert "opportunity_id" in item
        assert "expected_recovery_value_minor" in item
        assert "recovery_probability" in item
        assert "recommended_action" in item
        assert "policy_status" in item
        assert "explainability" in item


def test_api_opportunity_summary():
    resp = client.get("/api/v1/opportunities/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert "total_opportunities" in summary
    assert "total_revenue_at_risk_minor" in summary
    assert "expected_recovery_value_minor" in summary
    assert "policy_eligible_count" in summary
    assert "policy_blocked_count" in summary
    assert "high_priority_count" in summary


def test_api_opportunity_detail_and_evaluate():
    # First get list to find an ID
    list_resp = client.get("/api/v1/opportunities?limit=1")
    if list_resp.status_code == 200 and len(list_resp.json()) > 0:
        opp_id = list_resp.json()[0]["opportunity_id"]
        
        detail_resp = client.get(f"/api/v1/opportunities/{opp_id}")
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["opportunity_id"] == opp_id
        assert len(detail["candidate_actions"]) > 0

        eval_resp = client.post(
            f"/api/v1/opportunities/{opp_id}/evaluate",
            json={"merchant_risk_ceiling": 65, "max_retry_ceiling": 2},
        )
        assert eval_resp.status_code == 200

import pytest
from backend.app.services.recovery.opportunity import OpportunityEngine
from backend.app.services.recovery.optimizer import StrategyOptimizer


def test_opportunity_engine_expected_value():
    amount_minor = 4500000  # ₹45,000
    prob = 82
    ev = OpportunityEngine.calculate_expected_value_minor(amount_minor, prob)
    assert ev == 3690000  # ₹36,900


def test_opportunity_engine_priority_ranking():
    opp_high = OpportunityEngine.create_opportunity(
        transaction_id="TXN-1",
        amount_minor=5000000,
        recovery_probability=85,
        risk_score=25,
        reason="Network timeout",
        recommended_action="Retry payment",
        policy_status="Approved",
    )
    opp_low = OpportunityEngine.create_opportunity(
        transaction_id="TXN-2",
        amount_minor=200000,
        recovery_probability=50,
        risk_score=45,
        reason="Dropout",
        recommended_action="Payment link",
        policy_status="Approved",
    )
    opp_blocked = OpportunityEngine.create_opportunity(
        transaction_id="TXN-3",
        amount_minor=8000000,
        recovery_probability=90,
        risk_score=85,
        reason="Stolen card",
        recommended_action="Retry payment",
        policy_status="Escalated",
    )

    ranked = OpportunityEngine.rank_opportunities([opp_low, opp_blocked, opp_high])
    # Approved opportunities should come before Escalated, sorted by EV
    assert ranked[0].transaction_id == "TXN-1"
    assert ranked[1].transaction_id == "TXN-2"
    assert ranked[2].transaction_id == "TXN-3"


def test_strategy_optimizer_selects_best_safe_action():
    res = StrategyOptimizer.optimize(
        transaction_id="TXN-OPT-1",
        amount_minor=3000000,
        reason="3DS authentication timeout",
        base_risk_score=35,
        base_recovery_probability=65,
        retry_count=1,
    )
    assert res.transaction_id == "TXN-OPT-1"
    assert len(res.evaluations) >= 4
    # Ensure best safe action has execution_allowed = True and positive EV
    assert res.highest_expected_value_minor > 0
    assert any(e.action == res.best_safe_action and e.execution_allowed for e in res.evaluations)

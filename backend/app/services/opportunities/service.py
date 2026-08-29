from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
import uuid

from backend.app.db.models import TransactionModel
from backend.app.db.seed import seed_canonical_database
from backend.app.services.opportunities.schemas import (
    OpportunityDetailResponse,
    OpportunitySummaryMetrics,
    CandidateActionEvaluation,
    OpportunityStatus,
    PriorityLevel,
    PolicyDecision,
)
from backend.app.services.opportunities.scoring import OpportunityScoringEngine
from backend.app.services.recovery.optimizer import StrategyOptimizer
from backend.app.services.policy.engine import DeterministicPolicyEngine


class OpportunityService:
    """
    Core service managing recovery opportunity lifecycle, rankings,
    policy gate integration, and summary aggregation.
    """

    @classmethod
    def get_opportunities(
        cls,
        db: Session,
        priority: Optional[str] = None,
        policy_status: Optional[str] = None,
        status: Optional[str] = None,
        source: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "expected_value",
        limit: int = 200,
        offset: int = 0,
    ) -> List[OpportunityDetailResponse]:
        seed_canonical_database(db)
        query = db.query(TransactionModel)

        if status and status.upper() != "ALL":
            query = query.filter(TransactionModel.status == status.upper())

        if source and source.lower() != "all":
            query = query.filter(TransactionModel.source == source.lower())

        if search:
            s = search.strip()
            search_pattern = f"%{s}%"
            clean_num = s.lower().replace("txn-", "").replace("txn", "")
            clean_pattern = f"%{clean_num}%" if clean_num else search_pattern
            query = query.filter(
                (TransactionModel.id.ilike(search_pattern))
                | (TransactionModel.id.ilike(clean_pattern))
                | (TransactionModel.provider_id.ilike(search_pattern))
                | (TransactionModel.reason.ilike(search_pattern))
                | (TransactionModel.action.ilike(search_pattern))
                | (TransactionModel.source.ilike(search_pattern))
                | (TransactionModel.status.ilike(search_pattern))
            )

        transactions = query.all()
        results: List[OpportunityDetailResponse] = []

        for t in transactions:
            opp = cls._build_opportunity_from_transaction(t)

            # Apply in-memory filters
            if priority and priority.upper() != "ALL" and opp.priority_level.upper() != priority.upper():
                continue
            if policy_status and policy_status.lower() != "all" and opp.policy_status.lower() != policy_status.lower():
                continue

            results.append(opp)

        # Sorting logic
        if sort_by == "amount":
            results.sort(key=lambda o: o.amount_minor, reverse=True)
        elif sort_by == "probability":
            results.sort(key=lambda o: o.recovery_probability, reverse=True)
        elif sort_by == "risk":
            results.sort(key=lambda o: o.risk_score, reverse=False)
        elif sort_by == "priority":
            results.sort(key=lambda o: o.priority_score, reverse=True)
        elif sort_by == "created_at":
            results.sort(key=lambda o: o.created_at, reverse=True)
        else:
            # Default: Expected Recovery Value descending
            results.sort(
                key=lambda o: (
                    1 if o.policy_status == "Approved" else 0,
                    o.expected_recovery_value_minor,
                    o.priority_score,
                ),
                reverse=True,
            )

        return results[offset : offset + limit]

    @classmethod
    def get_opportunity_by_id(
        cls,
        db: Session,
        opportunity_id: str,
    ) -> Optional[OpportunityDetailResponse]:
        seed_canonical_database(db)
        raw_id = opportunity_id.replace("opp-", "")
        txn = db.query(TransactionModel).filter(
            (TransactionModel.id == opportunity_id) | (TransactionModel.id == raw_id)
        ).first()

        if not txn:
            return None

        return cls._build_opportunity_from_transaction(txn, include_candidates=True)

    @classmethod
    def get_summary_metrics(cls, db: Session) -> OpportunitySummaryMetrics:
        seed_canonical_database(db)
        transactions = db.query(TransactionModel).all()

        total_opps = len(transactions)
        total_risk_minor = sum(t.amount_minor for t in transactions)
        total_ev_minor = sum(
            OpportunityScoringEngine.calculate_expected_recovery_value(t.amount_minor, t.recovery_probability)
            for t in transactions
        )

        eligible_count = 0
        blocked_count = 0
        high_priority_count = 0
        prob_sum = 0

        for t in transactions:
            ev = OpportunityScoringEngine.calculate_expected_recovery_value(t.amount_minor, t.recovery_probability)
            is_eligible = t.policy == "Approved" and t.risk_score < 70
            score, level = OpportunityScoringEngine.calculate_priority_score(
                expected_value_minor=ev,
                recovery_probability=t.recovery_probability,
                risk_score=t.risk_score,
                policy_eligible=is_eligible,
            )

            if is_eligible:
                eligible_count += 1
            else:
                blocked_count += 1

            if level in ["CRITICAL", "HIGH"]:
                high_priority_count += 1

            prob_sum += t.recovery_probability

        avg_prob = round(prob_sum / total_opps, 1) if total_opps > 0 else 0.0

        return OpportunitySummaryMetrics(
            total_opportunities=total_opps,
            total_revenue_at_risk_minor=total_risk_minor,
            expected_recovery_value_minor=total_ev_minor,
            policy_eligible_count=eligible_count,
            policy_blocked_count=blocked_count,
            high_priority_count=high_priority_count,
            average_recovery_probability=avg_prob,
            mode="database-backed",
        )

    @classmethod
    def refresh_opportunities(cls, db: Session) -> List[OpportunityDetailResponse]:
        """Refreshes all opportunities against the latest policy rules."""
        return cls.get_opportunities(db=db, limit=200)

    @classmethod
    def _build_opportunity_from_transaction(
        cls,
        txn: TransactionModel,
        include_candidates: bool = False,
    ) -> OpportunityDetailResponse:
        ev_minor = OpportunityScoringEngine.calculate_expected_recovery_value(
            amount_minor=txn.amount_minor,
            recovery_probability=txn.recovery_probability,
        )

        is_eligible = txn.policy == "Approved" and txn.risk_score < 70
        priority_score, priority_level = OpportunityScoringEngine.calculate_priority_score(
            expected_value_minor=ev_minor,
            recovery_probability=txn.recovery_probability,
            risk_score=txn.risk_score,
            policy_eligible=is_eligible,
        )

        policy_decision: PolicyDecision = "Approved" if txn.policy == "Approved" else ("Blocked" if txn.risk_score >= 70 else "Escalated")
        status: OpportunityStatus = "ELIGIBLE" if is_eligible else ("POLICY_BLOCKED" if txn.risk_score >= 70 else "ESCALATED")

        # Evaluate candidate playbooks
        opt_res = StrategyOptimizer.optimize(
            transaction_id=txn.id,
            amount_minor=txn.amount_minor,
            reason=txn.reason,
            base_risk_score=txn.risk_score,
            base_recovery_probability=txn.recovery_probability,
            retry_count=1,
            policy_threshold=70,
        )

        candidates: List[CandidateActionEvaluation] = []
        if include_candidates:
            for eval_item in opt_res.evaluations:
                decision_str: PolicyDecision = "Approved" if eval_item.policy_decision == "Approved" else ("Blocked" if eval_item.policy_decision == "Blocked" else "Escalated")
                candidates.append(
                    CandidateActionEvaluation(
                        action=eval_item.action,
                        recovery_probability=eval_item.recovery_probability,
                        risk_score=eval_item.risk_score,
                        expected_value_minor=eval_item.expected_value_minor,
                        policy_decision=decision_str,
                        execution_allowed=eval_item.execution_allowed,
                        policy_reason=eval_item.policy_reason,
                    )
                )

        explainability = OpportunityScoringEngine.generate_explainability(
            amount_minor=txn.amount_minor,
            expected_value_minor=ev_minor,
            recovery_probability=txn.recovery_probability,
            risk_score=txn.risk_score,
            failure_signature=txn.reason,
            recommended_action=opt_res.best_safe_action,
            policy_status=policy_decision,
            policy_reason=opt_res.rationale,
        )

        opp_id = f"opp-{txn.id}"

        return OpportunityDetailResponse(
            id=opp_id,
            opportunity_id=opp_id,
            transaction_id=txn.id,
            amount_minor=txn.amount_minor,
            currency="INR",
            failure_signature=txn.reason,
            risk_score=txn.risk_score,
            recovery_probability=txn.recovery_probability,
            expected_recovery_value_minor=ev_minor,
            expected_value_minor=ev_minor,
            priority_score=priority_score,
            priority_level=priority_level,
            priority=priority_level,
            recommended_action=txn.action,
            best_safe_action=opt_res.best_safe_action,
            policy_status=policy_decision,
            reason=txn.reason,
            status=status,
            explainability=explainability,
            candidate_actions=candidates,
            created_at=txn.created_at or datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict

OpportunityStatus = Literal[
    "NEW",
    "ELIGIBLE",
    "POLICY_BLOCKED",
    "ESCALATED",
    "IN_PROGRESS",
    "RECOVERED",
    "FAILED",
    "EXPIRED",
]

PriorityLevel = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
PolicyDecision = Literal["Approved", "Blocked", "Escalated"]


class CandidateActionEvaluation(BaseModel):
    action: str
    recovery_probability: int
    risk_score: int
    expected_value_minor: int
    policy_decision: PolicyDecision
    execution_allowed: bool
    policy_reason: str


class OpportunityExplainability(BaseModel):
    why_priority: str
    why_action: str
    why_policy_status: str


class OpportunityDetailResponse(BaseModel):
    id: str
    opportunity_id: str
    transaction_id: str
    amount_minor: int
    currency: str = "INR"
    failure_signature: str
    risk_score: int
    recovery_probability: int
    expected_recovery_value_minor: int
    expected_value_minor: int
    priority_score: int
    priority_level: PriorityLevel
    priority: str
    recommended_action: str
    best_safe_action: str
    policy_status: PolicyDecision
    reason: str
    status: OpportunityStatus
    explainability: OpportunityExplainability
    candidate_actions: List[CandidateActionEvaluation] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpportunitySummaryMetrics(BaseModel):
    total_opportunities: int
    total_revenue_at_risk_minor: int
    expected_recovery_value_minor: int
    policy_eligible_count: int
    policy_blocked_count: int
    high_priority_count: int
    average_recovery_probability: float
    mode: str = "database-backed"


class OpportunityEvaluateRequest(BaseModel):
    merchant_risk_ceiling: Optional[int] = Field(None, ge=10, le=90)
    max_retry_ceiling: Optional[int] = Field(None, ge=1, le=5)
    min_probability_floor: Optional[int] = Field(None, ge=20, le=80)

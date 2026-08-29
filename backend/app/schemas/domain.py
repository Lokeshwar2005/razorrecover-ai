from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# Common Types
RecoveryResultType = str
PolicyDecisionType = str
WorkflowStatusType = Literal["READY", "RUNNING", "COMPLETE", "ESCALATED", "BLOCKED", "FAILED"]
PriorityType = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
UserRoleType = Literal["ADMIN", "OPERATOR", "ANALYST", "AUDITOR"]

RecoveryDirectionType = str


class TransactionBase(BaseModel):
    id: str = Field(..., description="Unique transaction ID e.g. TXN-1042 or RZP-pay_...")
    amount_minor: int = Field(..., gt=0, description="Amount in integer minor units (paise)")
    currency: str = Field(default="INR", max_length=3)
    source: str = "synthetic"
    reason: str = Field(..., description="Detected failure signature reason")
    direction: str = "Payment degradation"
    action: str = Field(default="Retry payment")
    
    confidence: int = Field(default=94, ge=0, le=100)
    recovery_probability: int = Field(default=72, ge=0, le=100)
    risk_score: int = Field(default=28, ge=0, le=100)
    policy: str = "Approved"
    explanation: Optional[str] = None
    provider_id: Optional[str] = None

    @property
    def amount_rupees(self) -> float:
        return self.amount_minor / 100.0


class TransactionCreate(TransactionBase):
    merchant_id: Optional[str] = None


class TransactionResponse(TransactionBase):
    merchant_id: Optional[str] = None
    status: str = "PENDING"
    verified_amount_minor: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# AI Diagnosis Schemas (Phase 26)
# ---------------------------------------------------------------------------

class AIDiagnosisRequest(BaseModel):
    transaction: TransactionBase
    failure_context: Optional[str] = None


class AIDiagnosisResponse(BaseModel):
    diagnosis: str
    root_cause: str
    recommended_action: str
    confidence: int = Field(..., ge=0, le=100)
    expected_recovery_probability: int = Field(..., ge=0, le=100)
    priority: PriorityType = "HIGH"
    explanation: str
    reasoning_factors: List[str] = Field(default_factory=list)
    model_name: str = "openrouter/free"
    policy_alignment: Literal["aligned", "escalate"] = "aligned"
    execution_allowed: bool = False
    policy_reason: str


# ---------------------------------------------------------------------------
# Recovery Opportunity Schemas (Phase 27)
# ---------------------------------------------------------------------------

class RecoveryOpportunityResponse(BaseModel):
    id: str
    transaction_id: str
    amount_minor: int
    recovery_probability: int
    expected_value_minor: int  # Amount * Probability
    priority: PriorityType
    recommended_action: str
    policy_status: str
    reason: str
    risk_score: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Strategy Optimizer Schemas (Phase 28)
# ---------------------------------------------------------------------------

class ActionCandidateEvaluation(BaseModel):
    action: str
    recovery_probability: int
    risk_score: int
    expected_value_minor: int
    policy_decision: PolicyDecisionType
    execution_allowed: bool
    policy_reason: str


class StrategyOptimizationResponse(BaseModel):
    transaction_id: str
    amount_minor: int
    best_safe_action: str
    highest_expected_value_minor: int
    evaluations: List[ActionCandidateEvaluation]
    rationale: str


# ---------------------------------------------------------------------------
# Historical Analytics Schemas (Phases 29 & 30)
# ---------------------------------------------------------------------------

class ActionPerformanceItem(BaseModel):
    action: str
    total_attempts: int
    verified_recoveries: int
    success_rate: float
    total_recovered_minor: int


class FailureDistributionItem(BaseModel):
    failure_signature: str
    count: int
    total_at_risk_minor: int
    recovered_minor: int
    recovery_rate: float


class HistoricalAnalyticsResponse(BaseModel):
    overall_recovery_rate: float
    total_revenue_at_risk_minor: int
    total_revenue_recovered_minor: int
    action_performance: List[ActionPerformanceItem]
    failure_distributions: List[FailureDistributionItem]


# ---------------------------------------------------------------------------
# Dashboard Command Center Schemas (Phase 24)
# ---------------------------------------------------------------------------

class TrendDataPoint(BaseModel):
    timestamp: str
    revenue_at_risk_minor: int
    revenue_recovered_minor: int
    recovery_rate: float


class DashboardStatsResponse(BaseModel):
    revenue_at_risk_minor: int
    revenue_recovered_minor: int
    recovery_rate: float
    failed_transactions_count: int
    active_recovery_attempts_count: int
    policy_blocks_count: int
    total_opportunities_value_minor: int
    average_ai_confidence: int
    velocity_minor_per_sec: int
    trends: List[TrendDataPoint]


# ---------------------------------------------------------------------------
# Policy Configuration Schemas (Phase 35)
# ---------------------------------------------------------------------------

class PolicyConfigurationUpdate(BaseModel):
    max_risk_ceiling: int = Field(..., ge=10, le=95)
    max_retry_ceiling: int = Field(..., ge=1, le=5)
    min_recovery_probability: int = Field(..., ge=10, le=90)
    allow_retry_payment: bool = True
    allow_payment_link: bool = True
    allow_customer_prompt: bool = True
    allow_voice_recovery: bool = True
    allow_ptp_tracker: bool = True


class PolicyConfigurationResponse(PolicyConfigurationUpdate):
    id: str
    merchant_id: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Agent Trace Schema

class AgentTraceStep(BaseModel):
    stage_index: int  # 0 to 7
    stage_name: str
    status: Literal["WAIT", "DONE", "STOP"]
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None
    decision: Optional[str] = None
    detail: str
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentTraceResponse(BaseModel):
    transaction_id: str
    current_stage: int
    overall_status: str
    steps: List[AgentTraceStep]


# ---------------------------------------------------------------------------
# Deterministic Policy Engine Schemas
# ---------------------------------------------------------------------------

class PolicyEvaluationRequest(BaseModel):
    transaction_id: str
    amount_minor: int = Field(..., gt=0)
    reason: str
    risk_score: int = Field(..., ge=0, le=100)
    recovery_probability: int = Field(..., ge=0, le=100)
    retry_count: int = Field(default=1, ge=0)
    action: str
    policy_threshold: int = Field(default=70, ge=0, le=100)


class PolicyEvaluationResponse(BaseModel):
    decision: PolicyDecisionType
    execution_allowed: bool
    boundary_rule: str
    policy_reason: str
    recommended_action: str
    risk_score: int
    recovery_probability: int
    retry_count: int


# Recovery Action Schemas
class RecoveryExecutionRequest(BaseModel):
    transaction_id: str
    action_type: str
    amount_minor: int = Field(..., gt=0)
    currency: str = "INR"
    recovery_operation_id: Optional[str] = None


class RecoveryExecutionResponse(BaseModel):
    transaction_id: str
    action_type: str
    workflow_status: WorkflowStatusType
    workflow_message: str
    recovery_operation_id: Optional[str] = None
    provider_id: Optional[str] = None
    payment_link: Optional[str] = None
    order_id: Optional[str] = None
    key_id: Optional[str] = None
    executed_at: datetime


# Payment Verification Schemas
class PaymentVerificationRequest(BaseModel):
    transaction_id: str
    payment_id: str = Field(..., description="Razorpay payment id e.g. pay_TVLdJPjhhrCBEs")
    order_id: Optional[str] = None
    signature: Optional[str] = None
    amount_minor: Optional[int] = None
    currency: str = "INR"


class PaymentVerificationResponse(BaseModel):
    transaction_id: str
    payment_id: str
    amount_minor: int
    currency: str
    status: str  # "captured" | "failed" | "pending"
    verified: bool
    verified_at: datetime
    message: str


# Audit Trail Schemas
class AuditEventResponse(BaseModel):
    id: str
    transaction_id: str
    event_type: str
    actor: str
    decision: Optional[str] = None
    reason: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    prev_event_hash: Optional[str] = None
    event_hash: str
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Counterfactual Simulation Schemas (Phase 34)
class CounterfactualRequest(BaseModel):
    original_transaction_id: str
    amount_minor: int = Field(..., gt=0)
    reason: str
    risk_score: int = Field(..., ge=1, le=99)
    recovery_probability: int = Field(..., ge=5, le=98)
    retry_attempts: int = Field(default=1, ge=1, le=3)
    policy_threshold: int = Field(default=70, ge=50, le=90)
    action_override: Optional[str] = None


class VariableDelta(BaseModel):
    variable: str
    original: Any
    counterfactual: Any
    changed: bool


class CounterfactualResponse(BaseModel):
    original_transaction_id: str
    original_decision: PolicyDecisionType
    counterfactual_decision: PolicyDecisionType
    original_result: RecoveryResultType
    counterfactual_result: RecoveryResultType
    original_expected_value_minor: int
    counterfactual_expected_value_minor: int
    expected_value_delta_minor: int
    outcome_flipped: bool
    deltas: List[VariableDelta]
    explanation: str
    simulated_at: datetime

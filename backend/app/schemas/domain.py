from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


# Common Types
RecoveryResultType = Literal["Recovered", "Stopped", "Pending"]
PolicyDecisionType = Literal["Approved", "Escalated"]
WorkflowStatusType = Literal["READY", "RUNNING", "COMPLETE", "ESCALATED"]
RecoveryDirectionType = Literal[
    "Payment degradation",
    "Checkout drop-off",
    "Failed-subscription recovery",
    "B2B receivables chaser",
    "Mandate retry sequencer",
    "Hinglish voice recovery",
    "Promise-to-pay tracker",
]


class TransactionBase(BaseModel):
    id: str = Field(..., description="Unique transaction ID e.g. TXN-1042 or RZP-pay_...")
    amount_minor: int = Field(..., gt=0, description="Amount in integer minor units (paise)")
    currency: str = Field(default="INR", max_length=3)
    source: Literal["synthetic", "razorpay"] = "synthetic"
    reason: str = Field(..., description="Detected failure signature reason")
    direction: RecoveryDirectionType = "Payment degradation"
    action: str = Field(default="Retry payment")
    
    confidence: int = Field(default=94, ge=0, le=100)
    recovery_probability: int = Field(default=72, ge=0, le=100)
    risk_score: int = Field(default=28, ge=0, le=100)
    policy: PolicyDecisionType = "Approved"
    explanation: Optional[str] = None
    provider_id: Optional[str] = None

    @property
    def amount_rupees(self) -> float:
        return self.amount_minor / 100.0


class TransactionCreate(TransactionBase):
    pass


class TransactionResponse(TransactionBase):
    status: RecoveryResultType = "Pending"
    verified_amount_minor: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# AI Diagnosis Schemas
class AIDiagnosisRequest(BaseModel):
    transaction: TransactionBase
    failure_context: Optional[str] = None


class AIDiagnosisResponse(BaseModel):
    diagnosis: str
    root_cause: str
    recommended_action: str
    confidence: int = Field(..., ge=0, le=100)
    recovery_probability: int = Field(..., ge=0, le=100)
    explanation: str
    model_name: str = "openrouter/free"
    policy_alignment: Literal["aligned", "escalate"] = "aligned"
    execution_allowed: bool = False
    policy_reason: str


# Deterministic Policy Engine Schemas
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


class RecoveryExecutionResponse(BaseModel):
    transaction_id: str
    action_type: str
    workflow_status: WorkflowStatusType
    workflow_message: str
    provider_id: Optional[str] = None
    payment_link: Optional[str] = None
    order_id: Optional[str] = None
    key_id: Optional[str] = None
    executed_at: datetime


# Payment Verification Schemas
class PaymentVerificationRequest(BaseModel):
    transaction_id: str
    payment_id: str = Field(..., description="Razorpay payment id e.g. pay_TVLdJPjhhrCBEs")
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


# Agent Trace Schemas
class AgentTraceResponse(BaseModel):
    id: str
    transaction_id: str
    stage_index: int
    stage_name: str
    status: Literal["WAIT", "DONE", "STOP"]
    detail: str
    recorded_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Counterfactual Simulation Schemas
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
    outcome_flipped: bool
    deltas: List[VariableDelta]
    explanation: str
    simulated_at: datetime

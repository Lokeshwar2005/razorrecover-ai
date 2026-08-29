import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Multi-Tenant Foundation (Phases 36 & 37)
# ---------------------------------------------------------------------------

class OrganizationModel(Base):
    __tablename__ = "organizations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(128), nullable=False)
    slug = Column(String(64), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    merchants = relationship("MerchantModel", back_populates="organization", cascade="all, delete-orphan")


class MerchantModel(Base):
    __tablename__ = "merchants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(128), nullable=False)
    razorpay_account_id = Column(String(64), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    organization = relationship("OrganizationModel", back_populates="merchants")
    users = relationship("UserModel", back_populates="merchant", cascade="all, delete-orphan")
    transactions = relationship("TransactionModel", back_populates="merchant", cascade="all, delete-orphan")
    policy_config = relationship("PolicyConfigurationModel", back_populates="merchant", uselist=False, cascade="all, delete-orphan")


class UserModel(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(128), nullable=False)
    role = Column(String(32), nullable=False, default="OPERATOR")  # "ADMIN" | "OPERATOR" | "ANALYST" | "AUDITOR"
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    merchant = relationship("MerchantModel", back_populates="users")


class PolicyConfigurationModel(Base):
    __tablename__ = "policy_configurations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    max_risk_ceiling = Column(Integer, nullable=False, default=70)
    max_retry_ceiling = Column(Integer, nullable=False, default=2)
    min_recovery_probability = Column(Integer, nullable=False, default=55)
    
    allow_retry_payment = Column(Boolean, nullable=False, default=True)
    allow_payment_link = Column(Boolean, nullable=False, default=True)
    allow_customer_prompt = Column(Boolean, nullable=False, default=True)
    allow_voice_recovery = Column(Boolean, nullable=False, default=True)
    allow_ptp_tracker = Column(Boolean, nullable=False, default=True)
    
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    merchant = relationship("MerchantModel", back_populates="policy_config")


# ---------------------------------------------------------------------------
# Core Transaction & Recovery Lifecycle (Phases 25, 26, 27, 28, 29, 31, 32)
# ---------------------------------------------------------------------------

class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    merchant_id = Column(String(36), ForeignKey("merchants.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Monetary values in integer minor units (paise for INR)
    amount_minor = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    source = Column(String(16), nullable=False, default="synthetic")  # "synthetic" | "razorpay"
    status = Column(String(16), nullable=False, default="PENDING")  # "PENDING" | "RECOVERED" | "STOPPED"
    
    # Contextual fields
    direction = Column(String(64), nullable=False, default="Payment degradation")
    reason = Column(String(255), nullable=False, default="Network degradation")
    action = Column(String(64), nullable=False, default="Retry payment")
    
    confidence = Column(Integer, nullable=False, default=94)
    recovery_probability = Column(Integer, nullable=False, default=72)
    risk_score = Column(Integer, nullable=False, default=28)
    policy = Column(String(16), nullable=False, default="Approved")  # "Approved" | "Escalated"
    explanation = Column(Text, nullable=True)
    
    provider_id = Column(String(64), nullable=True)  # Razorpay payment/order ID
    verified_amount_minor = Column(BigInteger, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    merchant = relationship("MerchantModel", back_populates="transactions")
    failure_events = relationship("FailureEventModel", back_populates="transaction", cascade="all, delete-orphan")
    ai_diagnoses = relationship("AIDiagnosisModel", back_populates="transaction", cascade="all, delete-orphan")
    policy_decisions = relationship("PolicyDecisionModel", back_populates="transaction", cascade="all, delete-orphan")
    recovery_actions = relationship("RecoveryActionModel", back_populates="transaction", cascade="all, delete-orphan")
    payment_verifications = relationship("PaymentVerificationModel", back_populates="transaction", cascade="all, delete-orphan")
    audit_events = relationship("AuditEventModel", back_populates="transaction", cascade="all, delete-orphan")
    agent_traces = relationship("AgentTraceModel", back_populates="transaction", cascade="all, delete-orphan")
    opportunity = relationship("RecoveryOpportunityModel", back_populates="transaction", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_transactions_status_created", "status", "created_at"),
        Index("ix_transactions_source_status", "source", "status"),
        Index("ix_transactions_risk_prob", "risk_score", "recovery_probability"),
    )


class FailureEventModel(Base):
    __tablename__ = "failure_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    failure_code = Column(String(64), nullable=True)
    failure_signature = Column(String(128), nullable=False, index=True)
    raw_payload = Column(Text, nullable=True)
    occurred_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="failure_events")


class AIDiagnosisModel(Base):
    __tablename__ = "ai_diagnoses"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    diagnosis = Column(Text, nullable=False)
    root_cause = Column(String(255), nullable=False)
    recommended_action = Column(String(64), nullable=False)
    confidence = Column(Integer, nullable=False)
    recovery_probability = Column(Integer, nullable=False)
    priority = Column(String(16), nullable=False, default="MEDIUM")  # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    explanation = Column(Text, nullable=False)
    reasoning_factors_json = Column(Text, nullable=True)
    model_name = Column(String(64), nullable=False, default="openrouter/free")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="ai_diagnoses")


class PolicyDecisionModel(Base):
    __tablename__ = "policy_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    risk_score = Column(Integer, nullable=False)
    recovery_probability = Column(Integer, nullable=False)
    retry_count = Column(Integer, nullable=False, default=1)
    decision = Column(String(16), nullable=False, index=True)  # "APPROVED" | "ESCALATED"
    boundary_rule = Column(String(128), nullable=False)
    policy_reason = Column(Text, nullable=False)
    execution_allowed = Column(Boolean, nullable=False, default=False)
    evaluated_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="policy_decisions")


class RecoveryActionModel(Base):
    __tablename__ = "recovery_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = Column(String(64), nullable=False)
    workflow_status = Column(String(16), nullable=False, default="READY")  # "READY" | "RUNNING" | "COMPLETE" | "ESCALATED"
    workflow_message = Column(Text, nullable=False)
    executed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="recovery_actions")
    verifications = relationship("PaymentVerificationModel", back_populates="recovery_action")


class PaymentVerificationModel(Base):
    __tablename__ = "payment_verifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    recovery_action_id = Column(String(36), ForeignKey("recovery_actions.id", ondelete="SET NULL"), nullable=True)
    
    razorpay_order_id = Column(String(64), nullable=True, index=True)
    razorpay_payment_id = Column(String(64), nullable=True, index=True)
    amount_minor = Column(BigInteger, nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    status = Column(String(32), nullable=False, index=True)  # "captured" | "failed" | "pending"
    verified = Column(Boolean, nullable=False, default=False)  # ONLY true when status === 'captured'
    verified_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="payment_verifications")
    recovery_action = relationship("RecoveryActionModel", back_populates="verifications")


class AuditEventModel(Base):
    __tablename__ = "audit_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    actor = Column(String(64), nullable=False, default="System")
    decision = Column(String(32), nullable=True)
    reason = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    
    # Cryptographic SHA-256 Tamper-Evident Chaining
    prev_event_hash = Column(String(64), nullable=True)
    event_hash = Column(String(64), nullable=False, index=True)
    
    recorded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    transaction = relationship("TransactionModel", back_populates="audit_events")


class AgentTraceModel(Base):
    __tablename__ = "agent_traces"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_index = Column(Integer, nullable=False)  # 0 to 7 (8 stages in Trace 2.0)
    stage_name = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False)  # "WAIT" | "DONE" | "STOP"
    input_summary = Column(Text, nullable=True)
    output_summary = Column(Text, nullable=True)
    decision = Column(String(32), nullable=True)
    detail = Column(Text, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="agent_traces")


class RecoveryOpportunityModel(Base):
    __tablename__ = "recovery_opportunities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String(64), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    amount_minor = Column(BigInteger, nullable=False)
    recovery_probability = Column(Integer, nullable=False)
    expected_value_minor = Column(BigInteger, nullable=False)  # Amount * Probability
    priority = Column(String(16), nullable=False, default="HIGH", index=True)  # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    recommended_action = Column(String(64), nullable=False)
    policy_status = Column(String(16), nullable=False, default="Approved")
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="opportunity")


class HistoricalStatModel(Base):
    __tablename__ = "historical_stats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    failure_signature = Column(String(128), nullable=False, index=True)
    action_type = Column(String(64), nullable=False, index=True)
    
    total_attempts = Column(Integer, nullable=False, default=0)
    verified_recoveries = Column(Integer, nullable=False, default=0)
    success_rate = Column(Float, nullable=False, default=0.0)
    total_recovered_minor = Column(BigInteger, nullable=False, default=0)
    
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)


class CounterfactualRunModel(Base):
    __tablename__ = "counterfactual_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_transaction_id = Column(String(64), nullable=False, index=True)
    
    input_amount_minor = Column(BigInteger, nullable=False)
    input_reason = Column(String(255), nullable=False)
    input_risk_score = Column(Integer, nullable=False)
    input_recovery_probability = Column(Integer, nullable=False)
    input_retry_attempts = Column(Integer, nullable=False)
    input_policy_threshold = Column(Integer, nullable=False)
    
    original_decision = Column(String(16), nullable=False)
    counterfactual_decision = Column(String(16), nullable=False)
    original_expected_value_minor = Column(BigInteger, nullable=False, default=0)
    counterfactual_expected_value_minor = Column(BigInteger, nullable=False, default=0)
    
    outcome_flipped = Column(Boolean, nullable=False, default=False)
    delta_json = Column(Text, nullable=True)
    explanation = Column(Text, nullable=False)
    
    executed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

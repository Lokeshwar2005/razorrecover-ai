import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
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


class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(String(64), primary_key=True, index=True)
    # Monetary values stored in integer minor units (e.g. paise for INR, 100 paise = 1 INR)
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
    
    provider_id = Column(String(64), nullable=True)  # Razorpay payment/order ID if live
    verified_amount_minor = Column(BigInteger, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    failure_events = relationship("FailureEventModel", back_populates="transaction", cascade="all, delete-orphan")
    ai_diagnoses = relationship("AIDiagnosisModel", back_populates="transaction", cascade="all, delete-orphan")
    policy_decisions = relationship("PolicyDecisionModel", back_populates="transaction", cascade="all, delete-orphan")
    recovery_actions = relationship("RecoveryActionModel", back_populates="transaction", cascade="all, delete-orphan")
    payment_verifications = relationship("PaymentVerificationModel", back_populates="transaction", cascade="all, delete-orphan")
    audit_events = relationship("AuditEventModel", back_populates="transaction", cascade="all, delete-orphan")
    agent_traces = relationship("AgentTraceModel", back_populates="transaction", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_transactions_status_created", "status", "created_at"),
        Index("ix_transactions_source_status", "source", "status"),
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
    explanation = Column(Text, nullable=False)
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
    stage_index = Column(Integer, nullable=False)  # 0 to 6
    stage_name = Column(String(64), nullable=False)
    status = Column(String(16), nullable=False)  # "WAIT" | "DONE" | "STOP"
    detail = Column(Text, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    transaction = relationship("TransactionModel", back_populates="agent_traces")


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
    outcome_flipped = Column(Boolean, nullable=False, default=False)
    delta_json = Column(Text, nullable=True)
    explanation = Column(Text, nullable=False)
    
    executed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

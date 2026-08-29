-- RazorRecover AI 2.0 - Initial PostgreSQL Schema
-- Bounded Autonomy Financial Revenue Recovery Ledger

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(64) PRIMARY KEY,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    source VARCHAR(16) NOT NULL DEFAULT 'synthetic',
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    direction VARCHAR(64) NOT NULL DEFAULT 'Payment degradation',
    reason VARCHAR(255) NOT NULL DEFAULT 'Network degradation',
    action VARCHAR(64) NOT NULL DEFAULT 'Retry payment',
    confidence INTEGER NOT NULL DEFAULT 94,
    recovery_probability INTEGER NOT NULL DEFAULT 72,
    risk_score INTEGER NOT NULL DEFAULT 28,
    policy VARCHAR(16) NOT NULL DEFAULT 'Approved',
    explanation TEXT,
    provider_id VARCHAR(64),
    verified_amount_minor BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_transactions_id ON transactions (id);
CREATE INDEX IF NOT EXISTS ix_transactions_status_created ON transactions (status, created_at);
CREATE INDEX IF NOT EXISTS ix_transactions_source_status ON transactions (source, status);

CREATE TABLE IF NOT EXISTS failure_events (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    failure_code VARCHAR(64),
    failure_signature VARCHAR(128) NOT NULL,
    raw_payload TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_failure_events_txn_id ON failure_events (transaction_id);
CREATE INDEX IF NOT EXISTS ix_failure_events_signature ON failure_events (failure_signature);

CREATE TABLE IF NOT EXISTS ai_diagnoses (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    root_cause VARCHAR(255) NOT NULL,
    recommended_action VARCHAR(64) NOT NULL,
    confidence INTEGER NOT NULL,
    recovery_probability INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    model_name VARCHAR(64) NOT NULL DEFAULT 'openrouter/free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_ai_diagnoses_txn_id ON ai_diagnoses (transaction_id);

CREATE TABLE IF NOT EXISTS policy_decisions (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    risk_score INTEGER NOT NULL,
    recovery_probability INTEGER NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 1,
    decision VARCHAR(16) NOT NULL,
    boundary_rule VARCHAR(128) NOT NULL,
    policy_reason TEXT NOT NULL,
    execution_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_policy_decisions_txn_id ON policy_decisions (transaction_id);
CREATE INDEX IF NOT EXISTS ix_policy_decisions_decision ON policy_decisions (decision);

CREATE TABLE IF NOT EXISTS recovery_actions (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL,
    workflow_status VARCHAR(16) NOT NULL DEFAULT 'READY',
    workflow_message TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_recovery_actions_txn_id ON recovery_actions (transaction_id);

CREATE TABLE IF NOT EXISTS payment_verifications (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    recovery_action_id VARCHAR(36) REFERENCES recovery_actions(id) ON DELETE SET NULL,
    razorpay_order_id VARCHAR(64),
    razorpay_payment_id VARCHAR(64),
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_payment_verifications_txn_id ON payment_verifications (transaction_id);
CREATE INDEX IF NOT EXISTS ix_payment_verifications_order_id ON payment_verifications (razorpay_order_id);
CREATE INDEX IF NOT EXISTS ix_payment_verifications_payment_id ON payment_verifications (razorpay_payment_id);
CREATE INDEX IF NOT EXISTS ix_payment_verifications_status ON payment_verifications (status);

CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    actor VARCHAR(64) NOT NULL DEFAULT 'System',
    decision VARCHAR(32),
    reason VARCHAR(255),
    metadata_json TEXT,
    prev_event_hash VARCHAR(64),
    event_hash VARCHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_audit_events_txn_id ON audit_events (transaction_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_event_type ON audit_events (event_type);
CREATE INDEX IF NOT EXISTS ix_audit_events_event_hash ON audit_events (event_hash);
CREATE INDEX IF NOT EXISTS ix_audit_events_recorded_at ON audit_events (recorded_at);

CREATE TABLE IF NOT EXISTS agent_traces (
    id VARCHAR(36) PRIMARY KEY,
    transaction_id VARCHAR(64) NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    stage_index INTEGER NOT NULL,
    stage_name VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    detail TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_agent_traces_txn_id ON agent_traces (transaction_id);

CREATE TABLE IF NOT EXISTS counterfactual_runs (
    id VARCHAR(36) PRIMARY KEY,
    original_transaction_id VARCHAR(64) NOT NULL,
    input_amount_minor BIGINT NOT NULL,
    input_reason VARCHAR(255) NOT NULL,
    input_risk_score INTEGER NOT NULL,
    input_recovery_probability INTEGER NOT NULL,
    input_retry_attempts INTEGER NOT NULL,
    input_policy_threshold INTEGER NOT NULL,
    original_decision VARCHAR(16) NOT NULL,
    counterfactual_decision VARCHAR(16) NOT NULL,
    outcome_flipped BOOLEAN NOT NULL DEFAULT FALSE,
    delta_json TEXT,
    explanation TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_counterfactual_runs_orig_txn_id ON counterfactual_runs (original_transaction_id);

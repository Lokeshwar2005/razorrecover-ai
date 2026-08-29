import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from backend.app.db.models import Base
from backend.app.services.audit.ledger import AuditLedgerService


@pytest.fixture
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    Session = sessionmaker(bind=test_engine)
    session = Session()
    yield session
    session.close()


def test_audit_event_hash_chaining(db_session):
    txn_id = "TXN-TEST-99"

    # Record Event 1
    e1 = AuditLedgerService.record_event(
        db=db_session,
        transaction_id=txn_id,
        event_type="TRANSACTION_DETECTED",
        actor="Payment Stream",
        decision="INGESTED",
        reason="Bank timeout",
    )
    assert e1.prev_event_hash is None
    assert len(e1.event_hash) == 64

    # Record Event 2
    e2 = AuditLedgerService.record_event(
        db=db_session,
        transaction_id=txn_id,
        event_type="POLICY_APPROVED",
        actor="Deterministic Policy Gate",
        decision="Approved",
        reason="Safe limits",
    )
    assert e2.prev_event_hash == e1.event_hash
    assert len(e2.event_hash) == 64

    # Verify cryptographic chain
    assert AuditLedgerService.verify_chain(db_session, txn_id) is True

    # Tamper test: Modify e1 reason directly in DB
    e1.reason = "Tampered reason"
    db_session.commit()

    # Chain verification MUST fail
    assert AuditLedgerService.verify_chain(db_session, txn_id) is False

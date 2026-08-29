from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.core.config import settings
from backend.app.db.session import get_db
from backend.app.db.models import TransactionModel, RecoveryActionModel, PaymentVerificationModel

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_connected = False
    db_type = "postgresql" if "postgresql" in settings.SQLALCHEMY_DATABASE_URL else "sqlite"
    total_count = 0
    synthetic_count = 0
    provider_test_count = 0
    live_count = 0
    latest_txn_time = None
    latest_sync_time = None

    try:
        # Check database connectivity
        db.execute(text("SELECT 1"))
        db_connected = True

        # Query counts
        txns = db.query(TransactionModel).all()
        total_count = len(txns)
        synthetic_count = sum(1 for t in txns if t.source == "synthetic")
        provider_test_count = sum(1 for t in txns if t.source == "razorpay_test")
        live_count = sum(1 for t in txns if t.source == "live")

        if total_count > 0:
            latest_txn = max(txns, key=lambda t: t.created_at or datetime.min.replace(tzinfo=timezone.utc))
            latest_txn_time = latest_txn.created_at.isoformat() if latest_txn.created_at else None

            provider_txns = [t for t in txns if t.source in ("razorpay_test", "live")]
            if provider_txns:
                latest_provider = max(provider_txns, key=lambda t: t.created_at or datetime.min.replace(tzinfo=timezone.utc))
                latest_sync_time = latest_provider.created_at.isoformat() if latest_provider.created_at else None
    except Exception:
        db_connected = False

    return {
        "status": "healthy" if db_connected else "degraded",
        "service": "RazorRecover AI Backend",
        "database_connected": db_connected,
        "database_type": db_type,
        "canonical_transaction_count": total_count,
        "synthetic_count": synthetic_count,
        "provider_test_count": provider_test_count,
        "live_count": live_count,
        "latest_transaction_timestamp": latest_txn_time,
        "latest_sync_timestamp": latest_sync_time,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "bounded-deterministic-autonomy",
    }


@router.get("/health/data")
def health_data_diagnostic(db: Session = Depends(get_db)):
    """
    Authoritative database diagnostic endpoint exposing canonical telemetry
    without revealing database URLs, credentials, or provider secrets.
    """
    db_connected = False
    db_type = "postgresql" if "postgresql" in settings.SQLALCHEMY_DATABASE_URL else "sqlite"
    total_txns = 0
    synthetic_txns = 0
    provider_test_txns = 0
    live_txns = 0
    recovery_ops_count = 0
    verified_recoveries_count = 0
    latest_txn_at = None
    latest_sync_at = None

    try:
        db.execute(text("SELECT 1"))
        db_connected = True

        txns = db.query(TransactionModel).all()
        total_txns = len(txns)
        synthetic_txns = sum(1 for t in txns if t.source == "synthetic")
        provider_test_txns = sum(1 for t in txns if t.source == "razorpay_test")
        live_txns = sum(1 for t in txns if t.source == "live")
        verified_recoveries_count = sum(1 for t in txns if t.status == "RECOVERED")

        recovery_ops_count = db.query(RecoveryActionModel).count()

        if total_txns > 0:
            latest_txn = max(txns, key=lambda t: t.created_at or datetime.min.replace(tzinfo=timezone.utc))
            latest_txn_at = latest_txn.created_at.isoformat() if latest_txn.created_at else None

            provider_txns = [t for t in txns if t.source in ("razorpay_test", "live")]
            if provider_txns:
                latest_provider = max(provider_txns, key=lambda t: t.created_at or datetime.min.replace(tzinfo=timezone.utc))
                latest_sync_at = latest_provider.created_at.isoformat() if latest_provider.created_at else None
    except Exception:
        db_connected = False

    return {
        "status": "healthy" if db_connected else "degraded",
        "database": db_type,
        "database_connected": db_connected,
        "transactions": total_txns,
        "synthetic_transactions": synthetic_txns,
        "razorpay_test_transactions": provider_test_txns,
        "live_transactions": live_txns,
        "recovery_operations": recovery_ops_count,
        "verified_recoveries": verified_recoveries_count,
        "latest_transaction_at": latest_txn_at,
        "latest_sync_at": latest_sync_at,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

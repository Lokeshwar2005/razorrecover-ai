import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.db.models import AuditEventModel


def format_timestamp(dt: datetime) -> str:
    """Produces a deterministic ISO-8601 UTC timestamp string across databases."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class AuditLedgerService:
    """
    Cryptographic SHA-256 Tamper-Evident Audit Ledger.
    
    Every critical decision generates a chained cryptographic hash,
    ensuring tamper-evident audit trails for compliance and operators.
    """

    @staticmethod
    def calculate_hash(
        prev_hash: Optional[str],
        transaction_id: str,
        event_type: str,
        decision: Optional[str],
        reason: Optional[str],
        metadata_str: str,
        timestamp_str: str,
    ) -> str:
        payload = f"{prev_hash or '0'*64}|{transaction_id}|{event_type}|{decision or ''}|{reason or ''}|{metadata_str}|{timestamp_str}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @classmethod
    def record_event(
        cls,
        db: Session,
        transaction_id: str,
        event_type: str,
        actor: str = "System",
        decision: Optional[str] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditEventModel:
        # Fetch the latest audit event for this transaction to chain hashes
        latest_event = (
            db.query(AuditEventModel)
            .filter(AuditEventModel.transaction_id == transaction_id)
            .order_by(AuditEventModel.recorded_at.desc())
            .first()
        )
        prev_hash = latest_event.event_hash if latest_event else None
        
        now = datetime.now(timezone.utc)
        meta_str = json.dumps(metadata or {}, sort_keys=True)
        ts_str = format_timestamp(now)
        
        event_hash = cls.calculate_hash(
            prev_hash=prev_hash,
            transaction_id=transaction_id,
            event_type=event_type,
            decision=decision,
            reason=reason,
            metadata_str=meta_str,
            timestamp_str=ts_str,
        )

        event = AuditEventModel(
            transaction_id=transaction_id,
            event_type=event_type,
            actor=actor,
            decision=decision,
            reason=reason,
            metadata_json=meta_str,
            prev_event_hash=prev_hash,
            event_hash=event_hash,
            recorded_at=now,
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    @classmethod
    def verify_chain(cls, db: Session, transaction_id: str) -> bool:
        """Verifies that no audit records in the event chain have been altered."""
        events = (
            db.query(AuditEventModel)
            .filter(AuditEventModel.transaction_id == transaction_id)
            .order_by(AuditEventModel.recorded_at.asc())
            .all()
        )
        if not events:
            return True

        prev_hash = None
        for event in events:
            expected_hash = cls.calculate_hash(
                prev_hash=prev_hash,
                transaction_id=event.transaction_id,
                event_type=event.event_type,
                decision=event.decision,
                reason=event.reason,
                metadata_str=event.metadata_json or "{}",
                timestamp_str=format_timestamp(event.recorded_at),
            )
            if event.event_hash != expected_hash:
                return False
            prev_hash = event.event_hash

        return True

from sqlalchemy.orm import Session
from datetime import datetime, timezone
import time

from backend.app.db.models import TransactionModel
from backend.app.services.recovery.engine import create_synthetic_transaction
from backend.app.services.razorpay.service import RazorpayService

INITIAL_RAZORPAY_TEST_FIXTURES = [
    {
        "id": "pay_TVWRbgbZZuldtX",
        "amount": 76800,
        "currency": "INR",
        "status": "captured",
        "method": "card",
        "created_at": 1788015000,
        "description": "Premium Subscription Tier",
    },
    {
        "id": "pay_TVKcFPdvHDKIPQ",
        "amount": 76800,
        "currency": "INR",
        "status": "failed",
        "method": "upi",
        "created_at": 1788014200,
        "error_description": "Bank timeout - issuer unavailable",
    },
    {
        "id": "pay_TVKaknokzpndeV",
        "amount": 76800,
        "currency": "INR",
        "status": "failed",
        "method": "card",
        "created_at": 1788013800,
        "error_description": "3DS challenge expired",
    },
]

def seed_canonical_database(db: Session, scenario: str = "balanced", force: bool = False) -> int:
    """
    Idempotently seeds the 100 canonical synthetic transactions plus
    authoritative Razorpay Test fixtures into the database.
    """
    total_count = db.query(TransactionModel).count()
    if total_count > 0 and not force:
        return 0

    existing_ids = {t[0] for t in db.query(TransactionModel.id).all()}
    added_count = 0

    # 1. Seed 100 synthetic transactions (TXN-1042 down to TXN-0943, including TXN-1033)
    for i in range(100):
        txn_dict = create_synthetic_transaction(i, scenario)
        if txn_dict["id"] not in existing_ids:
            txn = TransactionModel(
                id=txn_dict["id"],
                merchant_id="mer_default",
                amount_minor=txn_dict["amount_minor"],
                currency=txn_dict["currency"],
                source="synthetic",
                status=txn_dict["status"],
                direction=txn_dict["direction"],
                reason=txn_dict["reason"],
                action=txn_dict["action"],
                confidence=txn_dict["confidence"],
                recovery_probability=txn_dict["recovery_probability"],
                risk_score=txn_dict["risk_score"],
                policy=txn_dict["policy"],
                explanation=txn_dict["explanation"],
                verified_amount_minor=txn_dict["amount_minor"] if txn_dict["status"] == "RECOVERED" else 0,
            )
            db.add(txn)
            existing_ids.add(txn_dict["id"])
            added_count += 1

    # 2. Seed Initial Razorpay Test Mode fixtures
    for p in INITIAL_RAZORPAY_TEST_FIXTURES:
        pid = p["id"]
        txn_id = f"RZP-{pid}"
        if txn_id not in existing_ids:
            is_captured = p.get("status") == "captured"
            reason = p.get("error_description") or ("Checkout capture received" if is_captured else "Gateway degradation / bank timeout")
            txn = TransactionModel(
                id=txn_id,
                merchant_id="mer_razorpay",
                amount_minor=p["amount"],
                currency=p.get("currency", "INR"),
                source="razorpay_test",
                status="STOPPED" if p.get("status") == "failed" else "PENDING",
                direction="Failed-subscription recovery" if "subscription" in reason.lower() else "Payment degradation",
                reason=reason,
                action="Retry payment" if p.get("status") == "failed" else "Review payment",
                confidence=94,
                recovery_probability=72 if p.get("status") == "failed" else 88,
                risk_score=32 if p.get("status") == "failed" else 12,
                policy="Approved",
                explanation=f"Ingested from Razorpay Test Mode payment {pid}.",
                provider_id=pid,
                verified_amount_minor=0,
            )
            db.add(txn)
            existing_ids.add(txn_id)
            added_count += 1

    if added_count > 0:
        db.commit()

    return added_count

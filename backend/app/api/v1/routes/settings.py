from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid

from backend.app.db.session import get_db
from backend.app.db.models import PolicyConfigurationModel
from backend.app.schemas.domain import (
    PolicyConfigurationResponse,
    PolicyConfigurationUpdate,
)

router = APIRouter(prefix="/settings", tags=["Merchant Settings & Policies"])


@router.get("/policies", response_model=PolicyConfigurationResponse)
def get_merchant_policy_configuration(db: Session = Depends(get_db)):
    config = db.query(PolicyConfigurationModel).first()
    if not config:
        # Create default safe configuration
        config = PolicyConfigurationModel(
            id=str(uuid.uuid4()),
            merchant_id="merchant_default_demo",
            max_risk_ceiling=70,
            max_retry_ceiling=2,
            min_recovery_probability=55,
            allow_retry_payment=True,
            allow_payment_link=True,
            allow_customer_prompt=True,
            allow_voice_recovery=True,
            allow_ptp_tracker=True,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    return config


@router.put("/policies", response_model=PolicyConfigurationResponse)
def update_merchant_policy_configuration(
    payload: PolicyConfigurationUpdate,
    db: Session = Depends(get_db),
):
    # Strict validation: prevent unsafe policy boundaries
    if payload.max_risk_ceiling > 90:
        raise HTTPException(status_code=400, detail="Risk ceiling cannot exceed 90% for security compliance.")
    if payload.max_retry_ceiling > 4:
        raise HTTPException(status_code=400, detail="Max retries cannot exceed 4 to prevent gateway rate-limiting.")
    if payload.min_recovery_probability < 20:
        raise HTTPException(status_code=400, detail="Recovery probability floor cannot be set below 20%.")

    config = db.query(PolicyConfigurationModel).first()
    if not config:
        config = PolicyConfigurationModel(
            id=str(uuid.uuid4()),
            merchant_id="merchant_default_demo",
            max_risk_ceiling=payload.max_risk_ceiling,
            max_retry_ceiling=payload.max_retry_ceiling,
            min_recovery_probability=payload.min_recovery_probability,
            allow_retry_payment=payload.allow_retry_payment,
            allow_payment_link=payload.allow_payment_link,
            allow_customer_prompt=payload.allow_customer_prompt,
            allow_voice_recovery=payload.allow_voice_recovery,
            allow_ptp_tracker=payload.allow_ptp_tracker,
        )
        db.add(config)
    else:
        config.max_risk_ceiling = payload.max_risk_ceiling
        config.max_retry_ceiling = payload.max_retry_ceiling
        config.min_recovery_probability = payload.min_recovery_probability
        config.allow_retry_payment = payload.allow_retry_payment
        config.allow_payment_link = payload.allow_payment_link
        config.allow_customer_prompt = payload.allow_customer_prompt
        config.allow_voice_recovery = payload.allow_voice_recovery
        config.allow_ptp_tracker = payload.allow_ptp_tracker
        config.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(config)
    return config

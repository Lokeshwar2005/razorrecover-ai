from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.schemas.domain import HistoricalAnalyticsResponse
from backend.app.services.analytics.learning import HistoricalLearningService

router = APIRouter(prefix="/analytics", tags=["Historical Analytics & Learning"])


@router.get("/recovery", response_model=HistoricalAnalyticsResponse)
def get_recovery_analytics(db: Session = Depends(get_db)):
    return HistoricalLearningService.get_recovery_analytics(db)

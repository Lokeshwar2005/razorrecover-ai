from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "RazorRecover AI 2.0 Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "bounded-deterministic-autonomy",
    }

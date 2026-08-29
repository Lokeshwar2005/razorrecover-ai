from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1.routes import (
    analytics,
    audit,
    counterfactual,
    dashboard,
    health,
    opportunities,
    recovery,
    settings as settings_routes,
    transactions,
)
from backend.app.core.config import settings
from backend.app.db.session import init_db, SessionLocal
from backend.app.db.seed import seed_canonical_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    db = SessionLocal()
    try:
        seed_canonical_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Autonomous Explainable Revenue Recovery Intelligence Platform (Razorpay AI Buildathon 2026 - Track 3)",
    version="3.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if settings.DEBUG else "An unexpected error occurred",
        },
    )


# Mount API v1 routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(opportunities.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(settings_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(transactions.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(counterfactual.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
def root_redirect():
    return {
        "service": "RazorRecover AI Platform API",
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
        "status": "online",
    }

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.api.v1.routes import (
    audit,
    counterfactual,
    health,
    recovery,
    transactions,
)
from backend.app.core.config import settings
from backend.app.db.session import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Deterministic Bounded Autonomy AI Revenue Recovery Platform (Razorpay AI Buildathon 2026 - Track 3)",
    version="2.0.0",
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
app.include_router(recovery.router, prefix=settings.API_V1_PREFIX)
app.include_router(transactions.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit.router, prefix=settings.API_V1_PREFIX)
app.include_router(counterfactual.router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    return {
        "project": "RazorRecover AI 2.0",
        "track": "Track 3: AI Revenue Recovery (Razorpay AI Buildathon 2026)",
        "docs": "/docs",
        "api_v1": "/api/v1",
    }

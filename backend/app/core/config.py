from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "RazorRecover AI"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:8000",
        "https://lokeshwar2005.github.io",
        "https://razorrecover-ai-teal.vercel.app",
    ]

    # Database configuration (Defaults to local SQLite for tests, PostgreSQL in production)
    DATABASE_URL: str = "sqlite:///./razorrecover.db"

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url

    # AI Service (OpenRouter / Claude)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openrouter/free"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Razorpay Test Mode Credentials
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_BASE_URL: str = "https://api.razorpay.com/v1"

    # Policy Safety Boundaries
    MAX_RETRY_CEILING: int = 2
    MAX_RISK_CEILING: int = 70
    MIN_RECOVERY_PROBABILITY: int = 55

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()

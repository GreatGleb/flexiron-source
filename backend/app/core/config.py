from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/flexiron"

    # Security
    secret_key: str = "change-me-to-a-random-secret"
    session_ttl_hours: int = 8
    remember_ttl_days: int = 30

    # CORS
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    # Frontend
    frontend_url: str = "http://localhost:5173"

    # Rate limits
    login_rate_limit_per_min: int = 5
    register_rate_limit_per_hour: int = 3
    password_change_rate_limit_per_min: int = 3

    # Uploads
    max_upload_size_mb: int = 20
    upload_whitelist_mime: list[str] = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png",
        "image/jpeg",
    ]
    draft_ttl_hours: int = 24


settings = Settings()

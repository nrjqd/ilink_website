from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "I-Link API"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "sqlite:///./ilink_dev.db"

    jwt_secret: str = Field(default="change-me-in-production")
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_name: str | None = None
    r2_public_base_url: str | None = None

    frontend_url: str = "http://localhost:3000,http://127.0.0.1:5174"
    trusted_hosts: str = "localhost,127.0.0.1,testserver"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_url.split(",") if origin.strip()]

    @property
    def allowed_hosts(self) -> list[str]:
        return [host.strip() for host in self.trusted_hosts.split(",") if host.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"

    @property
    def r2_enabled(self) -> bool:
        return all(
            [
                self.r2_account_id,
                self.r2_access_key_id,
                self.r2_secret_access_key,
                self.r2_bucket_name,
                self.r2_public_base_url,
            ]
        )

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if not self.is_production:
            return self
        if self.jwt_secret == "change-me-in-production" or len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be changed to at least 32 characters in production.")
        if "*" in self.cors_origins:
            raise ValueError("FRONTEND_URL must not contain '*' when APP_ENV=production.")
        if not self.allowed_hosts or "*" in self.allowed_hosts:
            raise ValueError("TRUSTED_HOSTS must be explicit when APP_ENV=production.")
        if self.database_url.startswith("sqlite"):
            raise ValueError("DATABASE_URL must point to PostgreSQL when APP_ENV=production.")
        if not self.r2_enabled:
            raise ValueError("R2 settings must be fully configured when APP_ENV=production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

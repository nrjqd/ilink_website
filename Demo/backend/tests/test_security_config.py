import pytest
from pydantic import ValidationError

from app.core.config import Settings


PRODUCTION_R2_SETTINGS = {
    "r2_account_id": "account",
    "r2_access_key_id": "access-key",
    "r2_secret_access_key": "secret-key",
    "r2_bucket_name": "ilink-media",
    "r2_public_base_url": "https://media.example.test",
}


def test_production_rejects_default_jwt_secret():
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(
            app_env="production",
            jwt_secret="change-me-in-production",
            trusted_hosts="api.example.com",
            frontend_url="https://example.com",
        )


def test_production_rejects_wildcard_cors_origin():
    with pytest.raises(ValidationError, match="FRONTEND_URL"):
        Settings(
            app_env="production",
            jwt_secret="a-secure-production-secret-value",
            trusted_hosts="api.example.com",
            frontend_url="*",
        )


def test_production_rejects_wildcard_trusted_hosts():
    with pytest.raises(ValidationError, match="TRUSTED_HOSTS"):
        Settings(
            app_env="production",
            jwt_secret="a-secure-production-secret-value",
            trusted_hosts="*",
            frontend_url="https://example.com",
        )


def test_production_rejects_sqlite_database_url():
    with pytest.raises(ValidationError, match="DATABASE_URL"):
        Settings(
            app_env="production",
            jwt_secret="a-secure-production-secret-value",
            trusted_hosts="api.example.com",
            frontend_url="https://example.com",
            database_url="sqlite:///./ilink_dev.db",
            **PRODUCTION_R2_SETTINGS,
        )


def test_production_requires_complete_r2_settings():
    with pytest.raises(ValidationError, match="R2 settings"):
        Settings(
            app_env="production",
            jwt_secret="a-secure-production-secret-value",
            trusted_hosts="api.example.com",
            frontend_url="https://example.com",
            database_url="postgresql+psycopg://postgres:postgres@db:5432/ilink",
            r2_account_id=None,
            r2_access_key_id=None,
            r2_secret_access_key=None,
            r2_bucket_name=None,
            r2_public_base_url=None,
        )


def test_production_accepts_explicit_security_settings():
    settings = Settings(
        app_env="production",
        jwt_secret="a-secure-production-secret-value",
        trusted_hosts="api.example.com",
        frontend_url="https://example.com",
        database_url="postgresql+psycopg://postgres:postgres@db:5432/ilink",
        **PRODUCTION_R2_SETTINGS,
    )

    assert settings.is_production is True
    assert settings.allowed_hosts == ["api.example.com"]
    assert settings.cors_origins == ["https://example.com"]

from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings, normalize_database_url


PRODUCTION_R2_SETTINGS = {
    "r2_account_id": "account",
    "r2_access_key_id": "access-key",
    "r2_secret_access_key": "test",
    "r2_bucket_name": "ilink-media",
    "r2_public_base_url": "https://media.example.test",
}


def test_normalize_postgresql_url_to_psycopg_driver():
    assert (
        normalize_database_url("postgresql://user:password@host/db?sslmode=require")
        == "postgresql+psycopg://user:password@host/db?sslmode=require"
    )


def test_normalize_keeps_explicit_psycopg_driver_unchanged():
    assert (
        normalize_database_url("postgresql+psycopg://user:password@host/db?sslmode=require")
        == "postgresql+psycopg://user:password@host/db?sslmode=require"
    )


def test_normalize_keeps_sqlite_url_unchanged():
    assert normalize_database_url("sqlite:///./test.db") == "sqlite:///./test.db"


def test_settings_normalizes_database_url_before_production_validation():
    settings = Settings(
        app_env="production",
        jwt_secret="a-secure-production-secret-value",
        trusted_hosts="api.example.com",
        frontend_url="https://example.com",
        database_url="postgresql://user:password@host/db?sslmode=require",
        **PRODUCTION_R2_SETTINGS,
    )

    assert settings.database_url == "postgresql+psycopg://user:password@host/db?sslmode=require"
    assert settings.is_production is True


def test_alembic_env_uses_settings_database_url():
    env_path = Path(__file__).resolve().parents[1] / "alembic" / "env.py"
    env_source = env_path.read_text(encoding="utf-8")

    assert 'config.set_main_option("sqlalchemy.url", get_settings().database_url)' in env_source


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

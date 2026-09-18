from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import Base
from app.dependencies.database import get_db
from app.main import app
from app.models import AuditLog, Media, Post, PostMedia, User  # noqa: F401


class FakeR2Client:
    def __init__(self) -> None:
        self.puts: list[dict] = []
        self.deletes: list[dict] = []

    def put_object(self, **kwargs):
        self.puts.append(kwargs)

    def delete_object(self, **kwargs):
        self.deletes.append(kwargs)


@pytest.fixture()
def fake_r2_client(monkeypatch) -> FakeR2Client:
    fake = FakeR2Client()
    monkeypatch.setattr("app.services.storage_service.boto3.client", lambda *_, **__: fake)
    return fake


@pytest.fixture()
def client(tmp_path, fake_r2_client) -> Generator[TestClient, None, None]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    settings = get_settings()
    settings.jwt_secret = "test-secret-with-at-least-32-bytes"
    settings.r2_account_id = "account"
    settings.r2_access_key_id = "access-key"
    settings.r2_secret_access_key = "secret-key"
    settings.r2_bucket_name = "ilink-media"
    settings.r2_public_base_url = "https://media.example.test"

    def override_get_db() -> Generator[Session, None, None]:
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def admin_headers(client: TestClient) -> dict[str, str]:
    with next(iter(app.dependency_overrides[get_db]())) as db:
        admin = User(
            email="teacher@example.com",
            password_hash=hash_password("ChangeMe123!"),
            display_name="I-Link Admin",
            role="admin",
            is_active=True,
        )
        db.add(admin)
        db.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "teacher@example.com", "password": "ChangeMe123!"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

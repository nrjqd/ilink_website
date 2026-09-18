import re
import asyncio
from datetime import datetime, timezone
from io import BytesIO
from uuid import UUID

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.dependencies.database import get_db
from app.main import app
from app.models.media import Media
from app.services.media_policy import FIXED_SITE_ASSET_FORBIDDEN_MESSAGE
from app.services.media_service import create_media_from_upload
from app.services.storage_service import StorageService


def _image_bytes(fmt: str, size: tuple[int, int] = (64, 48), mode: str = "RGB") -> bytes:
    buffer = BytesIO()
    Image.new(mode, size, color=(20, 120, 180)).save(buffer, format=fmt)
    return buffer.getvalue()


def _png_bytes() -> bytes:
    return _image_bytes("PNG")


class FakeUploadFile:
    def __init__(self, filename: str, content: bytes, content_type: str) -> None:
        self.filename = filename
        self._content = content
        self.content_type = content_type

    async def read(self) -> bytes:
        return self._content


def test_object_key_format_uses_upload_time_and_shared_uuid():
    keys = StorageService().build_post_object_keys(at=datetime(2026, 9, 17, 10, 30, tzinfo=timezone.utc))

    UUID(keys.uuid)
    assert keys.original == f"posts/2026/09/17/{keys.uuid}/original.webp"
    assert keys.large == f"posts/2026/09/17/{keys.uuid}/large.webp"
    assert keys.thumbnail == f"posts/2026/09/17/{keys.uuid}/thumbnail.webp"


class FakeR2Client:
    def __init__(self, fail_thumb: bool = False) -> None:
        self.fail_thumb = fail_thumb
        self.puts: list[dict] = []
        self.deletes: list[dict] = []

    def put_object(self, **kwargs):
        self.puts.append(kwargs)
        if self.fail_thumb and kwargs["Key"].endswith("/thumbnail.webp"):
            raise RuntimeError("simulated upload failure")

    def delete_object(self, **kwargs):
        self.deletes.append(kwargs)


def test_upload_uses_r2_variants_with_webp_content_type(client, admin_headers, monkeypatch):
    settings = StorageService().settings
    settings.r2_account_id = "account"
    settings.r2_access_key_id = "access-key"
    settings.r2_secret_access_key = "secret-key"
    settings.r2_bucket_name = "ilink-media"
    settings.r2_public_base_url = "https://media.example.test"
    fake = FakeR2Client()

    monkeypatch.setattr("app.services.storage_service.boto3.client", lambda *_, **__: fake)

    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("activity-photo.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 201
    media = response.json()
    assert media["bucket"] == "ilink-media"
    assert len(fake.puts) == 3
    assert {put["ContentType"] for put in fake.puts} == {"image/webp"}
    assert {put["CacheControl"] for put in fake.puts} == {"public, max-age=31536000, immutable"}

    keys = [put["Key"] for put in fake.puts]
    assert keys == [media["original_object_key"], media["large_object_key"], media["thumbnail_object_key"]]
    key_path = "/".join(keys[0].split("/")[1:-1])
    assert keys == [
        f"posts/{key_path}/original.webp",
        f"posts/{key_path}/large.webp",
        f"posts/{key_path}/thumbnail.webp",
    ]
    assert f"/{media['uuid']}/" in keys[0]
    assert media["mime_type"] == "image/webp"
    for key in keys:
        assert key.endswith(".webp")
        assert not key.endswith((".jpg", ".jpeg", ".png"))
    for forbidden in ("event", "qishan", "activity-photo", ".png", ".jpg", ".jpeg"):
        assert forbidden not in " ".join(keys)


@pytest.mark.parametrize(
    ("filename", "content", "content_type"),
    [
        ("photo.jpg", _image_bytes("JPEG"), "image/jpeg"),
        ("photo.jpeg", _image_bytes("JPEG"), "image/jpeg"),
        ("graphic.png", _image_bytes("PNG"), "image/png"),
        ("source.webp", _image_bytes("WEBP"), "image/webp"),
    ],
)
def test_upload_accepts_common_input_formats_but_stores_only_webp(client, admin_headers, fake_r2_client, filename, content, content_type):
    response = client.post(
        "/api/v1/admin/uploads",
        headers=admin_headers,
        files={"file": (filename, content, content_type)},
    )

    assert response.status_code == 201
    media = response.json()
    assert media["original_filename"] == filename
    assert media["mime_type"] == "image/webp"
    stored_keys = [put["Key"] for put in fake_r2_client.puts[-3:]]
    assert stored_keys == [
        media["original_object_key"],
        media["large_object_key"],
        media["thumbnail_object_key"],
    ]
    assert [key.rsplit("/", 1)[-1] for key in stored_keys] == ["original.webp", "large.webp", "thumbnail.webp"]
    assert not any(key.lower().endswith((".jpg", ".jpeg", ".png")) for key in stored_keys)


def test_upload_rejects_disallowed_extension(client, admin_headers, fake_r2_client):
    response = client.post(
        "/api/v1/admin/uploads",
        headers=admin_headers,
        files={"file": ("image.gif", _png_bytes(), "image/png")},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UPLOAD_INVALID_EXTENSION"
    assert fake_r2_client.puts == []


def test_posts_media_can_be_uploaded_listed_updated_and_deleted(client, admin_headers, fake_r2_client):
    upload = client.post(
        "/api/v1/admin/uploads",
        headers=admin_headers,
        files={"file": ("article-cover.png", _png_bytes(), "image/png")},
    )

    assert upload.status_code == 201
    media = upload.json()
    assert media["original_object_key"].startswith("posts/")
    assert media["large_object_key"].startswith("posts/")
    assert media["thumbnail_object_key"].startswith("posts/")

    listing = client.get("/api/v1/admin/media", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == media["id"]

    update = client.patch(
        f"/api/v1/admin/media/{media['id']}",
        headers={**admin_headers, "Content-Type": "application/json"},
        json={"original_filename": "renamed-cover.webp"},
    )
    assert update.status_code == 200
    assert update.json()["original_filename"] == "renamed-cover.webp"

    delete = client.delete(f"/api/v1/admin/media/{media['id']}", headers=admin_headers)
    assert delete.status_code == 200
    assert [item["Key"] for item in fake_r2_client.deletes[-3:]] == [
        media["original_object_key"],
        media["large_object_key"],
        media["thumbnail_object_key"],
    ]
    assert client.get("/api/v1/admin/media", headers=admin_headers).json()["total"] == 0


def test_fixed_site_assets_are_hidden_from_admin_media_and_forbidden(client, admin_headers, fake_r2_client):
    fixed_keys = [
        "pages/關於/hero.webp",
        "pages/活動/hero.webp",
        "pages/結果/hero.webp",
        "places/旗山/main.webp",
    ]
    fixed_ids: list[int] = []

    with next(iter(app.dependency_overrides[get_db]())) as db:
        for index, key in enumerate(fixed_keys, start=1):
            media = Media(
                uuid=f"00000000-0000-0000-0000-00000000000{index}",
                original_filename=f"fixed-{index}.webp",
                storage_provider="r2",
                bucket="ilink-media",
                original_object_key=key,
                large_object_key=key.replace(".webp", "-large.webp"),
                thumbnail_object_key=key.replace(".webp", "-thumb.webp"),
                mime_type="image/webp",
                width=1200,
                height=800,
                file_size=2048,
            )
            db.add(media)
            db.flush()
            fixed_ids.append(media.id)
        db.commit()

    listing = client.get("/api/v1/admin/media", headers=admin_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] == 0
    assert listing.json()["items"] == []

    for media_id in fixed_ids:
        get_response = client.get(f"/api/v1/admin/media/{media_id}", headers=admin_headers)
        assert get_response.status_code == 403

        patch_response = client.patch(
            f"/api/v1/admin/media/{media_id}",
            headers={**admin_headers, "Content-Type": "application/json"},
            json={"original_filename": "cms-edit.webp"},
        )
        assert patch_response.status_code == 403
        assert patch_response.json()["error"]["message"] == FIXED_SITE_ASSET_FORBIDDEN_MESSAGE

        delete_response = client.delete(f"/api/v1/admin/media/{media_id}", headers=admin_headers)
        assert delete_response.status_code == 403
        assert delete_response.json()["error"]["message"] == FIXED_SITE_ASSET_FORBIDDEN_MESSAGE

    assert fake_r2_client.deletes == []


def test_article_fields_do_not_affect_media_object_keys(client, admin_headers):
    upload = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("cover.png", _png_bytes(), "image/png")},
    )
    media = upload.json()

    create = client.post(
        "/api/v1/posts",
        headers=admin_headers,
        json={
            "title": "旗山活動現場",
            "content": "Body",
            "category": "local_research",
            "event_date": "2026-03-17",
            "cover_media_id": media["id"],
        },
    )

    assert create.status_code == 201
    key = media["original_object_key"]
    assert re.match(r"^posts/\d{4}/\d{2}/\d{2}/[0-9a-f-]{36}/original\.webp$", key)
    assert "/2026/03/" not in key
    assert "event" not in key
    assert "qishan" not in key
    assert "旗山" not in key


def test_upload_without_r2_config_is_rejected(client, admin_headers):
    settings = StorageService().settings
    settings.r2_account_id = None
    settings.r2_access_key_id = None
    settings.r2_secret_access_key = None
    settings.r2_bucket_name = None
    settings.r2_public_base_url = None

    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("cover.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "R2_NOT_CONFIGURED"
    assert client.get("/api/v1/media", headers=admin_headers).json()["total"] == 0


def test_partial_r2_upload_failure_cleans_uploaded_objects(client, admin_headers, monkeypatch):
    settings = StorageService().settings
    settings.r2_account_id = "account"
    settings.r2_access_key_id = "access-key"
    settings.r2_secret_access_key = "secret-key"
    settings.r2_bucket_name = "ilink-media"
    settings.r2_public_base_url = "https://media.example.test"
    fake = FakeR2Client(fail_thumb=True)

    monkeypatch.setattr("app.services.storage_service.boto3.client", lambda *_, **__: fake)

    response = client.post(
        "/api/v1/media",
        headers=admin_headers,
        files={"file": ("cover.png", _png_bytes(), "image/png")},
    )

    assert response.status_code == 502
    uploaded_before_failure = [put["Key"] for put in fake.puts if not put["Key"].endswith("/thumbnail.webp")]
    deleted = [delete["Key"] for delete in fake.deletes]
    assert deleted == list(reversed(uploaded_before_failure))
    assert client.get("/api/v1/media", headers=admin_headers).json()["total"] == 0


def test_db_commit_failure_cleans_all_uploaded_objects(client, fake_r2_client, monkeypatch):
    with next(iter(app.dependency_overrides[get_db]())) as db:
        def fail_commit():
            raise RuntimeError("simulated db commit failure")

        monkeypatch.setattr(db, "commit", fail_commit)

        with pytest.raises(RuntimeError):
            asyncio.run(
                create_media_from_upload(
                    db,
                    FakeUploadFile("db-failure.png", _png_bytes(), "image/png"),
                )
            )

    uploaded = [put["Key"] for put in fake_r2_client.puts]
    deleted = [delete["Key"] for delete in fake_r2_client.deletes]
    assert len(uploaded) == 3
    assert deleted == list(reversed(uploaded))

    with next(iter(app.dependency_overrides[get_db]())) as db:
        assert db.scalar(select(func.count(Media.id))) == 0

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import uuid4

import boto3

from app.core.config import Settings, get_settings
from app.core.exceptions import api_error
from app.services.media_policy import CMS_MANAGED_PREFIX


@dataclass(frozen=True)
class ObjectKeySet:
    uuid: str
    original: str
    large: str
    thumbnail: str


class StorageService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    @property
    def bucket_name(self) -> str:
        return self.settings.r2_bucket_name or "ilink-media"

    def build_post_object_keys(self, media_uuid: str | None = None, at: datetime | None = None) -> ObjectKeySet:
        media_uuid = media_uuid or str(uuid4())
        at = at or datetime.now(timezone.utc)
        prefix = f"{CMS_MANAGED_PREFIX}{at:%Y}/{at:%m}/{at:%d}/{media_uuid}"
        return ObjectKeySet(
            uuid=media_uuid,
            original=f"{prefix}/original.webp",
            large=f"{prefix}/large.webp",
            thumbnail=f"{prefix}/thumbnail.webp",
        )

    def upload_object(self, object_key: str, content: bytes, content_type: str) -> None:
        self._ensure_r2_enabled()
        self._upload_to_r2(object_key, content, content_type)

    def delete_object(self, object_key: str) -> None:
        self._ensure_r2_enabled()
        self._delete_from_r2(object_key)

    def _ensure_r2_enabled(self) -> None:
        if not self.settings.r2_enabled:
            raise api_error(503, "R2_NOT_CONFIGURED", "R2 media storage is not configured.")

    def _upload_to_r2(self, object_key: str, content: bytes, content_type: str) -> None:
        endpoint = f"https://{self.settings.r2_account_id}.r2.cloudflarestorage.com"
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
        )
        try:
            client.put_object(
                Bucket=self.settings.r2_bucket_name,
                Key=object_key,
                Body=content,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
        except Exception as exc:
            raise api_error(502, "R2_UPLOAD_FAILED", "Media upload failed.") from exc

    def _delete_from_r2(self, object_key: str) -> None:
        endpoint = f"https://{self.settings.r2_account_id}.r2.cloudflarestorage.com"
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
        )
        try:
            client.delete_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except Exception as exc:
            raise api_error(502, "R2_DELETE_FAILED", "Media delete failed.") from exc

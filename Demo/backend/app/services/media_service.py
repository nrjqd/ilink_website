import logging

from fastapi import UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import api_error
from app.models.media import Media
from app.models.post import Post
from app.models.post_media import PostMedia
from app.schemas.media import MediaUpdate
from app.services.image_service import process_image
from app.services.media_policy import (
    CMS_MANAGED_PREFIX,
    FIXED_SITE_ASSET_FORBIDDEN_MESSAGE,
    is_cms_managed_media,
    is_fixed_site_asset,
)
from app.services.storage_service import StorageService

logger = logging.getLogger(__name__)


async def create_media_from_upload(db: Session, file: UploadFile) -> Media:
    content = await file.read()
    variants = process_image(content, file.content_type, file.filename)
    storage = StorageService()
    keys = storage.build_post_object_keys()
    uploaded_keys: list[str] = []

    try:
        storage.upload_object(keys.original, variants.original.bytes, "image/webp")
        uploaded_keys.append(keys.original)
        storage.upload_object(keys.large, variants.large.bytes, "image/webp")
        uploaded_keys.append(keys.large)
        storage.upload_object(keys.thumbnail, variants.thumbnail.bytes, "image/webp")
        uploaded_keys.append(keys.thumbnail)
    except Exception:
        _cleanup_uploaded_objects(storage, uploaded_keys)
        raise

    media = Media(
        uuid=keys.uuid,
        original_filename=file.filename or f"{keys.uuid}.webp",
        storage_provider="r2",
        bucket=storage.bucket_name,
        original_object_key=keys.original,
        large_object_key=keys.large,
        thumbnail_object_key=keys.thumbnail,
        mime_type="image/webp",
        width=variants.original.width,
        height=variants.original.height,
        file_size=len(variants.original.bytes),
    )
    try:
        db.add(media)
        db.commit()
        db.refresh(media)
        return media
    except Exception:
        db.rollback()
        _cleanup_uploaded_objects(storage, uploaded_keys)
        raise


def list_media(db: Session, *, page: int, limit: int, search: str | None = None) -> tuple[list[Media], int]:
    query = select(Media).where(Media.deleted_at.is_(None), cms_managed_media_filter())
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Media.original_filename.ilike(pattern),
                Media.original_object_key.ilike(pattern),
                Media.large_object_key.ilike(pattern),
                Media.thumbnail_object_key.ilike(pattern),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(Media.created_at.desc(), Media.id.desc()).offset((page - 1) * limit).limit(limit)).all()
    return list(items), total


def get_media_or_404(db: Session, media_id: int) -> Media:
    media = db.scalar(select(Media).where(Media.id == media_id, Media.deleted_at.is_(None)))
    if not media:
        raise api_error(404, "MEDIA_NOT_FOUND", "Media item was not found.")
    return media


def update_media(db: Session, media: Media, payload: MediaUpdate) -> Media:
    ensure_not_fixed_site_asset(media)
    data = payload.model_dump(exclude_unset=True)
    if "original_filename" in data and data["original_filename"] is not None:
        media.original_filename = data["original_filename"].strip()
    db.commit()
    db.refresh(media)
    return media


def delete_media(db: Session, media: Media) -> Media:
    ensure_not_fixed_site_asset(media)
    in_use = db.scalar(
        select(Post.id).where(Post.deleted_at.is_(None), Post.cover_media_id == media.id).limit(1)
    )
    if in_use is not None:
        raise api_error(409, "MEDIA_IN_USE", "Media is used as a post cover.")
    in_gallery = db.scalar(select(PostMedia.id).where(PostMedia.media_id == media.id).limit(1))
    if in_gallery is not None:
        raise api_error(409, "MEDIA_IN_USE", "Media is used in a post gallery.")

    storage = StorageService()
    for key in (media.original_object_key, media.large_object_key, media.thumbnail_object_key):
        storage.delete_object(key)

    db.delete(media)
    db.commit()
    return media


def _cleanup_uploaded_objects(storage: StorageService, object_keys: list[str]) -> None:
    for object_key in reversed(object_keys):
        try:
            storage.delete_object(object_key)
        except Exception:
            logger.exception("Failed to cleanup uploaded media object after upload failure.")


def ensure_not_fixed_site_asset(media: Media) -> None:
    if any(
        is_fixed_site_asset(key)
        for key in (media.original_object_key, media.large_object_key, media.thumbnail_object_key)
    ):
        raise api_error(403, "FIXED_SITE_ASSET_FORBIDDEN", FIXED_SITE_ASSET_FORBIDDEN_MESSAGE)


def is_cms_managed_media_record(media: Media) -> bool:
    return all(
        is_cms_managed_media(key)
        for key in (media.original_object_key, media.large_object_key, media.thumbnail_object_key)
    )


def cms_managed_media_filter():
    return (
        Media.original_object_key.startswith(CMS_MANAGED_PREFIX)
        & Media.large_object_key.startswith(CMS_MANAGED_PREFIX)
        & Media.thumbnail_object_key.startswith(CMS_MANAGED_PREFIX)
    )

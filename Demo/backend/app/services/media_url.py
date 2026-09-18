from urllib.parse import urlparse

from app.core.config import Settings, get_settings


def object_key_from_media_value(value: str | None, settings: Settings | None = None) -> str | None:
    if not value:
        return None
    settings = settings or get_settings()
    media_value = value.strip()
    if not media_value:
        return None

    if media_value.startswith("/uploads/"):
        return media_value.replace("/uploads/", "", 1).lstrip("/")

    if settings.r2_public_base_url:
        public_prefix = settings.r2_public_base_url.rstrip("/") + "/"
        if media_value.startswith(public_prefix):
            return media_value.removeprefix(public_prefix).lstrip("/")

    parsed = urlparse(media_value)
    if parsed.scheme:
        return None
    return media_value.lstrip("/")


def public_media_url(object_key: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    key = object_key.lstrip("/")
    if not settings.r2_public_base_url:
        return ""
    return f"{settings.r2_public_base_url.rstrip('/')}/{key}"


def media_reference_keys(*keys: str | None) -> set[str]:
    return {key for key in keys if key}

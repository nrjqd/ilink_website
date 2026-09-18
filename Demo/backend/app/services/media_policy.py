CMS_MANAGED_PREFIX = "posts/"
FIXED_ASSET_PREFIXES = ("pages/", "places/")
FIXED_SITE_ASSET_FORBIDDEN_MESSAGE = "此為固定網站素材，禁止透過 CMS 編輯或刪除。"


def _normalize_object_key(object_key: str | None) -> str:
    return (object_key or "").strip().lstrip("/")


def is_cms_managed_media(object_key: str | None) -> bool:
    return _normalize_object_key(object_key).startswith(CMS_MANAGED_PREFIX)


def is_fixed_site_asset(object_key: str | None) -> bool:
    key = _normalize_object_key(object_key)
    return key.startswith(FIXED_ASSET_PREFIXES)

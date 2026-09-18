from datetime import datetime

from pydantic import BaseModel, Field, computed_field
# BaseModel：用來建立 API 資料模型。

from app.services.media_url import public_media_url


class MediaResponse(BaseModel):
# API 回傳一筆媒體資料時，資料應該長什麼樣。
    id: int
    uuid: str
    original_filename: str
    storage_provider: str
    bucket: str
    original_object_key: str
    large_object_key: str
    thumbnail_object_key: str
    mime_type: str
    width: int | None
    height: int | None
    file_size: int
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
    # 允許 Pydantic 從 Python object 的屬性讀資料，而不只從 dictionary 讀。

    @computed_field
    # 告訴 Pydantic：下一個 property 也要當成 API response 裡的一個欄位。
    @property
    def original_url(self) -> str:
        return public_media_url(self.original_object_key)

    @computed_field
    @property
    def large_url(self) -> str:
        return public_media_url(self.large_object_key)

    @computed_field
    @property
    def thumbnail_url(self) -> str:
        return public_media_url(self.thumbnail_object_key)


class MediaUpdate(BaseModel):
    original_filename: str | None = Field(default=None, min_length=1, max_length=255)
    model_config = {"extra": "forbid"}


class PaginatedMedia(BaseModel):
    items: list[MediaResponse]
    page: int
    limit: int
    total: int

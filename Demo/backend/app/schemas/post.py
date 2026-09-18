from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.post import Category, Region
from app.schemas.media import MediaResponse


class PostMediaInput(BaseModel):
    media_id: int = Field(ge=1)
    sort_order: int = Field(default=0, ge=0)
    caption: str | None = Field(default=None, max_length=500)
    model_config = {"extra": "forbid"}


class PostMediaResponse(BaseModel):
    id: int
    post_id: int
    media_id: int
    sort_order: int
    caption: str | None
    media: MediaResponse
    created_at: datetime

    model_config = {"from_attributes": True}


class PostBase(BaseModel):
    title: str = Field(min_length=1, max_length=220)
    summary: str | None = None
    content: str = Field(min_length=1)
    cover_media_id: int | None = Field(default=None, ge=1)
    category: Category
    region: Region | None = None
    event_date: date | None = None


class PostCreate(PostBase):
    gallery_media: list[PostMediaInput] = Field(default_factory=list)
    model_config = {"extra": "forbid"}


class PostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=220)
    summary: str | None = None
    content: str | None = Field(default=None, min_length=1)
    cover_media_id: int | None = Field(default=None, ge=1)
    category: Category | None = None
    region: Region | None = None
    event_date: date | None = None
    gallery_media: list[PostMediaInput] | None = None
    model_config = {"extra": "forbid"}


class PostResponse(BaseModel):
    id: int
    title: str
    slug: str
    summary: str | None
    content: str
    cover_media_id: int | None
    cover_media: MediaResponse | None
    category: str | None
    region: str | None
    event_date: date | None
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    gallery_links: list[PostMediaResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PostListItem(BaseModel):
    id: int
    title: str
    slug: str
    summary: str | None
    content: str
    cover_media_id: int | None
    cover_media: MediaResponse | None
    category: str | None
    region: str | None
    event_date: date | None
    status: str
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None
    gallery_links: list[PostMediaResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PaginatedPosts(BaseModel):
    items: list[PostListItem]
    page: int
    limit: int
    total: int

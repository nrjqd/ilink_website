from datetime import datetime, timezone

from slugify import slugify
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import api_error
from app.models.media import Media
from app.models.post import Post, PostStatus
from app.models.post_media import PostMedia
from app.schemas.post import PostCreate, PostMediaInput, PostUpdate


def generate_unique_slug(db: Session, title: str, post_id: int | None = None) -> str:
    base = slugify(title, lowercase=True) or "post"
    slug = base
    suffix = 2
    while True:
        query = select(Post.id).where(Post.slug == slug)
        if post_id is not None:
            query = query.where(Post.id != post_id)
        if db.scalar(query) is None:
            return slug
        slug = f"{base}-{suffix}"
        suffix += 1


def apply_post_filters(
    query: Select[tuple[Post]],
    *,
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    with_event_date: bool = False,
) -> Select[tuple[Post]]:
    query = query.where(Post.deleted_at.is_(None))
    if region:
        query = query.where(Post.region == region)
    if category:
        query = query.where(Post.category == category)
    if status:
        query = query.where(Post.status == status)
    if with_event_date:
        query = query.where(Post.event_date.is_not(None))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Post.title.ilike(pattern), Post.summary.ilike(pattern), Post.content.ilike(pattern)))
    return query


def list_posts(
    db: Session,
    *,
    page: int,
    limit: int,
    region: str | None = None,
    category: str | None = None,
    status: str | None = None,
    search: str | None = None,
    timeline: bool = False,
) -> tuple[list[Post], int]:
    base_query = apply_post_filters(
        select(Post).options(
            selectinload(Post.cover_media),
            selectinload(Post.gallery_links).selectinload(PostMedia.media),
        ),
        region=region,
        category=category,
        status=status,
        search=search,
        with_event_date=timeline,
    )
    total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
    order = [Post.event_date.asc(), Post.id.asc()] if timeline else [Post.published_at.desc().nullslast(), Post.created_at.desc()]
    items = db.scalars(base_query.order_by(*order).offset((page - 1) * limit).limit(limit)).all()
    return list(items), total


def list_deleted_posts(
    db: Session,
    *,
    page: int,
    limit: int,
    search: str | None = None,
) -> tuple[list[Post], int]:
    query = select(Post).options(
        selectinload(Post.cover_media),
        selectinload(Post.gallery_links).selectinload(PostMedia.media),
    ).where(Post.deleted_at.is_not(None))
    if search:
        pattern = f"%{search}%"
        query = query.where(or_(Post.title.ilike(pattern), Post.summary.ilike(pattern), Post.content.ilike(pattern)))

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(
        query.order_by(Post.deleted_at.desc(), Post.id.desc()).offset((page - 1) * limit).limit(limit)
    ).all()
    return list(items), total


def get_post_or_404(db: Session, post_id: int) -> Post:
    post = db.scalar(
        select(Post)
        .options(
            selectinload(Post.cover_media),
            selectinload(Post.gallery_links).selectinload(PostMedia.media),
        )
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    if not post:
        raise api_error(404, "POST_NOT_FOUND", "Post was not found.")
    return post


def get_deleted_post_or_404(db: Session, post_id: int) -> Post:
    post = db.scalar(
        select(Post)
        .options(
            selectinload(Post.cover_media),
            selectinload(Post.gallery_links).selectinload(PostMedia.media),
        )
        .where(Post.id == post_id, Post.deleted_at.is_not(None))
    )
    if not post:
        raise api_error(404, "POST_NOT_FOUND", "Deleted post was not found.")
    return post


def get_published_post_by_slug_or_404(db: Session, slug: str) -> Post:
    post = db.scalar(
        select(Post)
        .options(
            selectinload(Post.cover_media),
            selectinload(Post.gallery_links).selectinload(PostMedia.media),
        )
        .where(Post.slug == slug, Post.status == PostStatus.PUBLISHED.value, Post.deleted_at.is_(None))
    )
    if not post:
        raise api_error(404, "POST_NOT_FOUND", "Post was not found.")
    return post


def _ensure_media_exists(db: Session, media_id: int | None) -> None:
    if media_id is None:
        return
    exists = db.scalar(select(Media.id).where(Media.id == media_id, Media.deleted_at.is_(None)))
    if exists is None:
        raise api_error(404, "MEDIA_NOT_FOUND", "Media item was not found.")


def _replace_gallery(db: Session, post: Post, gallery_media: list[PostMediaInput]) -> None:
    post.gallery_links.clear()
    if post.id is not None:
        db.flush()
    seen: set[int] = set()
    for item in gallery_media:
        if item.media_id in seen:
            raise api_error(400, "DUPLICATE_GALLERY_MEDIA", "Gallery media cannot contain duplicates.")
        seen.add(item.media_id)
        _ensure_media_exists(db, item.media_id)
        post.gallery_links.append(
            PostMedia(media_id=item.media_id, sort_order=item.sort_order, caption=item.caption)
        )


def create_post(db: Session, payload: PostCreate) -> Post:
    _ensure_media_exists(db, payload.cover_media_id)
    data = payload.model_dump(exclude={"gallery_media"})
    data["slug"] = generate_unique_slug(db, payload.title)
    data["category"] = payload.category.value
    data["region"] = payload.region.value if payload.region else None
    data["status"] = PostStatus.DRAFT.value

    post = Post(**data)
    _replace_gallery(db, post, payload.gallery_media)
    db.add(post)
    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post.id)


def update_post(db: Session, post: Post, payload: PostUpdate) -> Post:
    data = payload.model_dump(exclude_unset=True, exclude={"gallery_media"})
    if "cover_media_id" in data:
        _ensure_media_exists(db, data["cover_media_id"])
    if "category" in data and data["category"] is not None:
        data["category"] = data["category"].value
    if "region" in data and data["region"] is not None:
        data["region"] = data["region"].value

    for key, value in data.items():
        setattr(post, key, value)
    if payload.gallery_media is not None:
        _replace_gallery(db, post, payload.gallery_media)
    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post.id)


def set_post_status(db: Session, post: Post, status: PostStatus) -> Post:
    post.status = status.value
    if status == PostStatus.PUBLISHED and post.published_at is None:
        post.published_at = datetime.now(timezone.utc)
    if status == PostStatus.DRAFT:
        post.published_at = None
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post.id)


def archive_post(db: Session, post: Post) -> Post:
    post.status = PostStatus.ARCHIVED.value
    post.published_at = None
    post.deleted_at = None
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post.id)


def soft_delete_post(db: Session, post: Post) -> Post:
    post.deleted_at = datetime.now(timezone.utc)
    post.status = PostStatus.ARCHIVED.value
    post.published_at = None
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return get_deleted_post_or_404(db, post.id)


def restore_post(db: Session, post: Post) -> Post:
    post.deleted_at = None
    post.status = PostStatus.DRAFT.value
    post.published_at = None
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return get_post_or_404(db, post.id)


def permanently_delete_post(db: Session, post: Post) -> int:
    if post.deleted_at is None:
        raise api_error(400, "POST_NOT_IN_TRASH", "Only deleted posts can be permanently deleted.")

    post_id = post.id
    db.delete(post)
    db.commit()
    return post_id

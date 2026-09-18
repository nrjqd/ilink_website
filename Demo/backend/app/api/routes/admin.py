from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.dependencies.auth import get_current_admin
from app.dependencies.database import get_db
from app.models.media import Media
from app.models.post import Post, PostStatus
from app.models.post_media import PostMedia
from app.models.user import User
from app.schemas.media import MediaResponse
from app.schemas.post import PaginatedPosts, PostCreate, PostListItem, PostResponse, PostUpdate
from app.services.audit_log_service import log_audit_event
from app.services.media_service import cms_managed_media_filter, create_media_from_upload
from app.services.post_service import (
    archive_post,
    create_post,
    get_deleted_post_or_404,
    get_post_or_404,
    list_deleted_posts,
    list_posts,
    permanently_delete_post,
    restore_post,
    set_post_status,
    soft_delete_post,
    update_post,
)

router = APIRouter()


def _status_counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(Post.status, func.count(Post.id))
        .where(Post.deleted_at.is_(None))
        .group_by(Post.status)
    ).all()
    counts = {"draft": 0, "published": 0, "archived": 0}
    for status, count in rows:
        if status in counts:
            counts[status] = count
    counts["total"] = sum(counts.values())
    return counts


def _timeline_counts(db: Session) -> dict[str, int]:
    rows = db.execute(
        select(Post.status, func.count(Post.id))
        .where(Post.deleted_at.is_(None), Post.event_date.is_not(None))
        .group_by(Post.status)
    ).all()
    counts = {"draft": 0, "published": 0, "archived": 0}
    for status, count in rows:
        if status in counts:
            counts[status] = count
    counts["total"] = sum(counts.values())
    return counts


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    media_filter = cms_managed_media_filter()
    media_total = db.scalar(select(func.count(Media.id)).where(Media.deleted_at.is_(None), media_filter)) or 0
    media_total_bytes = (
        db.scalar(select(func.coalesce(func.sum(Media.file_size), 0)).where(Media.deleted_at.is_(None), media_filter)) or 0
    )
    recent_media = db.scalars(
        select(Media).where(Media.deleted_at.is_(None), media_filter).order_by(Media.created_at.desc(), Media.id.desc()).limit(8)
    ).all()
    return {
        "posts": _status_counts(db),
        "timeline_events": _timeline_counts(db),
        "media_total": media_total,
        "media_total_bytes": media_total_bytes,
        "recent_media": [MediaResponse.model_validate(item) for item in recent_media],
        "editable_areas": [
            {
                "key": "posts",
                "title": "Articles",
                "status": "managed",
                "admin_tab": "posts",
                "public_path": "/posts",
                "notes": ["Timeline is derived from published posts with event dates."],
            },
            {
                "key": "media",
                "title": "Media",
                "status": "managed",
                "admin_tab": "media",
                "public_path": "/",
                "notes": ["R2 stores all article images."],
            },
        ],
    }


@router.get("/cms")
def cms_snapshot(db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> dict:
    posts, post_total = list_posts(db, page=1, limit=100, timeline=False)
    timeline_posts, timeline_total = list_posts(
        db,
        page=1,
        limit=100,
        status=PostStatus.PUBLISHED.value,
        timeline=True,
    )
    media_filter = cms_managed_media_filter()
    media = db.scalars(
        select(Media).where(Media.deleted_at.is_(None), media_filter).order_by(Media.created_at.desc(), Media.id.desc()).limit(60)
    ).all()
    return {
        "posts": [PostResponse.model_validate(post) for post in posts],
        "timeline_events": [PostListItem.model_validate(post) for post in timeline_posts],
        "media": [MediaResponse.model_validate(item) for item in media],
        "totals": {"posts": post_total, "timeline_events": timeline_total, "media": len(media)},
    }


@router.get("/cms/health")
def cms_health(_: User = Depends(get_current_admin)) -> dict:
    settings = get_settings()
    ok_check = {"ok": True, "detail": None}
    return {
        "ok": True,
        "database_dialect": settings.database_url.split(":", 1)[0],
        "alembic_version": None,
        "expected_alembic_head": "20260908_0001",
        "r2_enabled": settings.r2_enabled,
        "tables": [
            {"name": "posts", **ok_check},
            {"name": "post_media", **ok_check},
            {"name": "media", **ok_check},
        ],
        "columns": [
            {"name": "posts.event_date", **ok_check},
            {"name": "posts.cover_media_id", **ok_check},
            {"name": "media.large_object_key", **ok_check},
        ],
        "foreign_keys": [
            {"name": "posts.cover_media_id -> media.id", **ok_check},
            {"name": "post_media.post_id -> posts.id", **ok_check},
            {"name": "post_media.media_id -> media.id", **ok_check},
        ],
    }


@router.post("/uploads", response_model=MediaResponse, status_code=201)
async def admin_upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Media:
    media = await create_media_from_upload(db, file)
    log_audit_event(db, actor=user, action="upload_media", entity_type="media", entity_id=media.id, details=media.original_filename)
    return media


@router.get("/posts", response_model=PaginatedPosts)
def admin_posts(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    status: PostStatus | None = None,
    search: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> PaginatedPosts:
    items, total = list_posts(db, page=page, limit=limit, status=status.value if status else None, search=search)
    return PaginatedPosts(items=items, page=page, limit=limit, total=total)


@router.get("/posts/trash", response_model=PaginatedPosts)
def admin_trash_posts(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> PaginatedPosts:
    items, total = list_deleted_posts(db, page=page, limit=limit, search=search)
    return PaginatedPosts(items=items, page=page, limit=limit, total=total)


@router.post("/posts", response_model=PostResponse, status_code=201)
def admin_create_post(payload: PostCreate, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = create_post(db, payload)
    log_audit_event(db, actor=user, action="create_post", entity_type="post", entity_id=post.id, details=post.title)
    return post


@router.get("/posts/{post_id}", response_model=PostResponse)
def admin_get_post(post_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> Post:
    return get_post_or_404(db, post_id)


@router.patch("/posts/{post_id}", response_model=PostResponse)
def admin_update_post(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Post:
    post = get_post_or_404(db, post_id)
    updated = update_post(db, post, payload)
    log_audit_event(db, actor=user, action="update_post", entity_type="post", entity_id=updated.id, details=updated.title)
    return updated


@router.delete("/posts/{post_id}", response_model=PostResponse)
def admin_delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = get_post_or_404(db, post_id)
    deleted = soft_delete_post(db, post)
    log_audit_event(db, actor=user, action="soft_delete_post", entity_type="post", entity_id=deleted.id, details=deleted.title)
    return deleted


@router.post("/posts/{post_id}/archive", response_model=PostResponse)
def admin_archive_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = get_post_or_404(db, post_id)
    archived = archive_post(db, post)
    log_audit_event(db, actor=user, action="archive_post", entity_type="post", entity_id=archived.id, details=archived.title)
    return archived


@router.post("/posts/{post_id}/restore", response_model=PostResponse)
def admin_restore_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = get_deleted_post_or_404(db, post_id)
    restored = restore_post(db, post)
    log_audit_event(db, actor=user, action="restore_post", entity_type="post", entity_id=restored.id, details=restored.title)
    return restored


@router.delete("/posts/{post_id}/permanent", status_code=status.HTTP_204_NO_CONTENT)
def admin_permanently_delete_post(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Response:
    post = get_deleted_post_or_404(db, post_id)
    post_title = post.title
    deleted_id = post.id
    permanently_delete_post(db, post)
    log_audit_event(db, actor=user, action="permanent_delete_post", entity_type="post", entity_id=deleted_id, details=post_title)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/posts/{post_id}/publish", response_model=PostResponse)
def admin_publish_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = get_post_or_404(db, post_id)
    updated = set_post_status(db, post, PostStatus.PUBLISHED)
    log_audit_event(db, actor=user, action="publish_post", entity_type="post", entity_id=updated.id, details=updated.title)
    return updated


@router.post("/posts/{post_id}/unpublish", response_model=PostResponse)
def admin_unpublish_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_admin)) -> Post:
    post = get_post_or_404(db, post_id)
    updated = set_post_status(db, post, PostStatus.DRAFT)
    log_audit_event(db, actor=user, action="unpublish_post", entity_type="post", entity_id=updated.id, details=updated.title)
    return updated

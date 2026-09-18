from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_admin
from app.dependencies.database import get_db
from app.models.post import Category, Post, PostStatus, Region
from app.models.user import User
from app.schemas.post import PaginatedPosts, PostCreate, PostResponse, PostUpdate
from app.services.audit_log_service import log_audit_event
from app.services.post_service import (
    archive_post,
    create_post,
    get_post_or_404,
    get_published_post_by_slug_or_404,
    list_posts,
    update_post,
)

router = APIRouter()


@router.get("", response_model=PaginatedPosts)
def get_posts(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    region: Region | None = None,
    category: Category | None = None,
    status: PostStatus | None = None,
    search: str | None = Query(default=None, max_length=120),
    timeline: bool = False,
    db: Session = Depends(get_db),
) -> PaginatedPosts:
    items, total = list_posts(
        db,
        page=page,
        limit=limit,
        region=region.value if region else None,
        category=category.value if category else None,
        status=status.value if status else None,
        search=search,
        timeline=timeline,
    )
    return PaginatedPosts(items=items, page=page, limit=limit, total=total)


@router.get("/id/{post_id}", response_model=PostResponse)
def get_post_by_id(post_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> Post:
    return get_post_or_404(db, post_id)


@router.get("/{slug}", response_model=PostResponse)
def get_post(slug: str, db: Session = Depends(get_db)) -> Post:
    return get_published_post_by_slug_or_404(db, slug)


@router.post("", response_model=PostResponse, status_code=201, deprecated=True)
def create_article(
    payload: PostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Post:
    post = create_post(db, payload)
    log_audit_event(db, actor=user, action="create_post", entity_type="post", entity_id=post.id, details=post.title)
    return post


@router.patch("/{post_id}", response_model=PostResponse, deprecated=True)
def patch_article(
    post_id: int,
    payload: PostUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Post:
    post = get_post_or_404(db, post_id)
    updated = update_post(db, post, payload)
    log_audit_event(db, actor=user, action="update_post", entity_type="post", entity_id=updated.id, details=updated.title)
    return updated


@router.delete("/{post_id}", response_model=PostResponse, deprecated=True)
def delete_article(
    post_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Post:
    post = get_post_or_404(db, post_id)
    archived = archive_post(db, post)
    log_audit_event(db, actor=user, action="archive_post", entity_type="post", entity_id=archived.id, details=archived.title)
    return archived

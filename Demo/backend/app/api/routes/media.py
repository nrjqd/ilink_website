from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.dependencies.auth import get_current_admin
from app.dependencies.database import get_db
from app.models.media import Media
from app.models.user import User
from app.schemas.media import MediaResponse, MediaUpdate, PaginatedMedia
from app.services.audit_log_service import log_audit_event
from app.services.media_service import (
    create_media_from_upload,
    delete_media,
    ensure_not_fixed_site_asset,
    get_media_or_404,
    list_media,
    update_media,
)

router = APIRouter()


@router.post("", response_model=MediaResponse, status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Media:
    media = await create_media_from_upload(db, file)
    log_audit_event(db, actor=user, action="upload_media", entity_type="media", entity_id=media.id, details=media.original_filename)
    return media


@router.get("", response_model=PaginatedMedia)
def get_media(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    search: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> PaginatedMedia:
    items, total = list_media(db, page=page, limit=limit, search=search)
    return PaginatedMedia(items=items, page=page, limit=limit, total=total)


@router.get("/{media_id}", response_model=MediaResponse)
def get_media_item(media_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)) -> Media:
    media = get_media_or_404(db, media_id)
    ensure_not_fixed_site_asset(media)
    return media


@router.patch("/{media_id}", response_model=MediaResponse)
def patch_media(
    media_id: int,
    payload: MediaUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> Media:
    media = update_media(db, get_media_or_404(db, media_id), payload)
    log_audit_event(db, actor=user, action="update_media", entity_type="media", entity_id=media.id, details=media.original_filename)
    return media


@router.delete("/{media_id}", response_model=MediaResponse)
def remove_media(
    media_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_admin),
) -> MediaResponse:
    media = get_media_or_404(db, media_id)
    response = MediaResponse.model_validate(media)
    delete_media(db, media)
    log_audit_event(db, actor=user, action="delete_media", entity_type="media", entity_id=media_id, details=response.original_filename)
    return response

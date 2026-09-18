from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import api_error
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.auth import CurrentUserResponse, LoginRequest, TokenResponse
from app.services.audit_log_service import log_audit_event
from app.services.auth_service import authenticate_user

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user, token = authenticate_user(db, payload.email, payload.password)
    if not user or not token:
        raise api_error(401, "AUTH_INVALID_CREDENTIALS", "Invalid email or password.")
    if user.role == "admin":
        log_audit_event(db, actor=user, action="login", entity_type="auth", entity_id=user.id, details=user.email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=CurrentUserResponse)
def me(user: User = Depends(get_current_user)) -> User:
    return user

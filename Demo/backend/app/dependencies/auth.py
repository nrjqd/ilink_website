import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import api_error, unauthorized
from app.core.security import decode_access_token
from app.dependencies.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise unauthorized()
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise unauthorized("Invalid token") from exc

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise unauthorized("Invalid token subject") from exc

    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active:
        raise unauthorized("Inactive or missing user")
    return user


def get_current_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise api_error(403, "AUTH_FORBIDDEN", "Admin role is required.")
    return user

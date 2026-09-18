from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.models.user import User


def authenticate_user(db: Session, email: str, password: str) -> tuple[User | None, str | None]:
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.is_active:
        return None, None
    if not verify_password(password, user.password_hash):
        return None, None
    return user, create_access_token(subject=str(user.id), role=user.role)

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.user import User  # noqa: E402


def main() -> int:
    if len(sys.argv) < 4:
        print('Usage: python scripts/create_admin.py "email" "password" "display name"', file=sys.stderr)
        return 1

    email, password, display_name = sys.argv[1], sys.argv[2], sys.argv[3]
    Base.metadata.create_all(bind=engine)

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            print(f"Admin already exists: {email}")
            return 0
        user = User(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
            role="admin",
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Created admin: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

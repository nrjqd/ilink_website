import argparse
import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"


def parse_modified(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def import_audit(path: Path, dry_run: bool) -> tuple[int, int]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    objects = payload.get("objects") or []
    eligible = [
        item
        for item in objects
        if str(item.get("key") or "").strip().startswith("posts/")
        and str(item.get("content_type") or "").startswith("image/")
    ]
    skipped = len(objects) - len(eligible)

    if dry_run:
        return len(eligible), skipped

    import sys

    if str(BACKEND) not in sys.path:
        sys.path.insert(0, str(BACKEND))

    from sqlalchemy import select

    from app.services.media_url import public_media_url
    from app.db.session import SessionLocal
    from app.models.media import Media

    bucket = payload.get("bucket") or "ilink-media"
    imported = 0

    with SessionLocal() as db:
        for item in eligible:
            key = str(item.get("key") or "").strip()
            content_type = str(item.get("content_type") or "")

            exists = db.scalar(
                select(Media.id).where(
                    (Media.original_object_key == key)
                    | (Media.large_object_key == key)
                    | (Media.thumbnail_object_key == key)
                )
            )
            if exists is not None:
                skipped += 1
                continue

            filename = Path(key).name or key.rsplit("/", 1)[-1] or f"{uuid4()}.webp"
            modified = parse_modified(item.get("last_modified"))
            data = {
                "legacy_object_key": key,
                "legacy_url": public_media_url(key),
                "legacy_filename": filename,
                "legacy_size": int(item.get("size") or 0),
                "uuid": str(uuid4()),
                "original_filename": filename,
                "storage_provider": "r2",
                "bucket": bucket,
                "original_object_key": key,
                "large_object_key": key,
                "thumbnail_object_key": key,
                "mime_type": content_type,
                "width": None,
                "height": None,
                "file_size": int(item.get("size") or 0),
            }
            if modified is not None:
                data["created_at"] = modified
                data["updated_at"] = modified
            media = Media(**data)
            db.add(media)
            imported += 1

        db.commit()

    return imported, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Import existing R2 audit media into the CMS media table.")
    parser.add_argument("audit_json", nargs="?", default=str(ROOT / "R2_MEDIA_AUDIT.json"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    imported, skipped = import_audit(Path(args.audit_json), args.dry_run)
    action = "would import" if args.dry_run else "imported"
    print(json.dumps({"ok": True, action: imported, "skipped": skipped}, ensure_ascii=False))


if __name__ == "__main__":
    main()

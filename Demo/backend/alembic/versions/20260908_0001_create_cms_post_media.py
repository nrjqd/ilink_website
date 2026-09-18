"""create cms post and media fields

Revision ID: 20260908_0001
Revises: 20260821_0003
Create Date: 2026-09-08
"""

from __future__ import annotations

from datetime import date
import re
from uuid import NAMESPACE_URL, uuid5

from alembic import op
import sqlalchemy as sa

revision = "20260908_0001"
down_revision = "20260821_0003"
branch_labels = None
depends_on = None


def _tables() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def _columns(table_name: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def _rename_if_exists(table_name: str, legacy_name: str) -> None:
    tables = _tables()
    if table_name in tables and legacy_name not in tables:
        op.rename_table(table_name, legacy_name)


def _drop_index_if_exists(index_name: str) -> None:
    bind = op.get_bind()
    indexes = {index["name"] for table in sa.inspect(bind).get_table_names() for index in sa.inspect(bind).get_indexes(table)}
    if index_name in indexes:
        op.drop_index(index_name)


def _create_post_indexes() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_posts_slug ON posts (slug)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_posts_status ON posts (status)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_posts_deleted_at ON posts (deleted_at)"))
    bind.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_posts_event_date ON posts (event_date)"))


def _create_users() -> None:
    if "users" in _tables():
        return
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False, server_default="admin"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def _create_media() -> None:
    if "media" in _tables():
        return
    op.create_table(
        "media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_provider", sa.String(length=32), nullable=False, server_default="r2"),
        sa.Column("bucket", sa.String(length=120), nullable=False, server_default="ilink-media"),
        sa.Column("original_object_key", sa.String(length=500), nullable=False),
        sa.Column("large_object_key", sa.String(length=500), nullable=False),
        sa.Column("thumbnail_object_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False, server_default="image/webp"),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("uuid", name="uq_media_uuid"),
        sa.UniqueConstraint("original_object_key", name="uq_media_original_object_key"),
        sa.UniqueConstraint("large_object_key", name="uq_media_large_object_key"),
        sa.UniqueConstraint("thumbnail_object_key", name="uq_media_thumbnail_object_key"),
    )
    op.create_index("ix_media_deleted_at", "media", ["deleted_at"])


def _create_posts() -> None:
    if "posts" in _tables():
        return
    op.create_table(
        "posts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=220), nullable=False),
        sa.Column("slug", sa.String(length=180), nullable=False),
        sa.Column("summary", sa.Text()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("cover_media_id", sa.Integer(), sa.ForeignKey("media.id", ondelete="SET NULL")),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("region", sa.String(length=32)),
        sa.Column("event_date", sa.Date()),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_posts_slug", "posts", ["slug"], unique=True)
    op.create_index("ix_posts_status", "posts", ["status"])
    op.create_index("ix_posts_deleted_at", "posts", ["deleted_at"])
    op.create_index("ix_posts_event_date", "posts", ["event_date"])


def _create_post_media() -> None:
    if "post_media" in _tables():
        return
    op.create_table(
        "post_media",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("media_id", sa.Integer(), sa.ForeignKey("media.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("caption", sa.String(length=500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("post_id", "media_id", name="uq_post_media_post_media"),
    )
    op.create_index("ix_post_media_post_id", "post_media", ["post_id"])
    op.create_index("ix_post_media_media_id", "post_media", ["media_id"])


def _create_audit_logs() -> None:
    if "audit_logs" in _tables():
        return
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id")),
        sa.Column("actor_email", sa.String(length=255)),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.Integer()),
        sa.Column("details", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def _parse_event_date(date_code: str | None) -> date | None:
    if not date_code:
        return None
    match = re.match(r"^(\d{2})(\d{2})", date_code)
    if not match:
        return None
    try:
        return date(2026, int(match.group(1)), int(match.group(2)))
    except ValueError:
        return None


def _migrate_legacy_media() -> None:
    if "legacy_media" not in _tables():
        return
    bind = op.get_bind()
    legacy_rows = bind.execute(sa.text("SELECT * FROM legacy_media ORDER BY id")).mappings().all()
    for row in legacy_rows:
        object_key = row["object_key"]
        bind.execute(
            sa.text(
                """
                INSERT INTO media (
                    id, uuid, original_filename, storage_provider, bucket,
                    original_object_key, large_object_key, thumbnail_object_key,
                    mime_type, width, height, file_size, created_at, updated_at, deleted_at
                )
                VALUES (
                    :id, :uuid, :original_filename, 'r2', 'ilink-media',
                    :object_key, :object_key, :object_key,
                    :mime_type, :width, :height, :file_size, :created_at, :created_at, NULL
                )
                """
            ),
            {
                "id": row["id"],
                "uuid": str(uuid5(NAMESPACE_URL, object_key)),
                "original_filename": row["filename"],
                "object_key": object_key,
                "mime_type": row["mime_type"],
                "width": row["width"],
                "height": row["height"],
                "file_size": row["size"],
                "created_at": row["created_at"],
            },
        )


def _migrate_legacy_posts() -> None:
    if "legacy_posts" not in _tables():
        return
    bind = op.get_bind()
    legacy_rows = bind.execute(sa.text("SELECT * FROM legacy_posts ORDER BY id")).mappings().all()
    for row in legacy_rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO posts (
                    title, slug, summary, content, cover_media_id, category, region,
                    event_date, status, published_at, created_at, updated_at, deleted_at
                )
                VALUES (
                    :title, :slug, :summary, :content, NULL, :category, :region,
                    NULL, :status, :published_at, :created_at, :updated_at, NULL
                )
                """
            ),
            {
                "title": row["title"],
                "slug": row["slug"],
                "summary": row["excerpt"] if "excerpt" in row else row["subtitle"],
                "content": row["content"],
                "category": row["category"],
                "region": row["region"],
                "status": row["status"],
                "published_at": row["published_at"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            },
        )


def _migrate_legacy_timeline_events() -> None:
    if "timeline_events" not in _tables():
        return
    bind = op.get_bind()
    event_rows = bind.execute(sa.text("SELECT * FROM timeline_events ORDER BY sort_order, id")).mappings().all()
    media_by_url = {
        row["url"]: row["id"]
        for row in bind.execute(sa.text("SELECT id, url FROM legacy_media")).mappings().all()
    } if "legacy_media" in _tables() else {}

    for event in event_rows:
        image_rows = bind.execute(
            sa.text("SELECT * FROM timeline_event_images WHERE event_id = :event_id ORDER BY sort_order, id"),
            {"event_id": event["id"]},
        ).mappings().all()
        cover_media_id = media_by_url.get(image_rows[0]["src"]) if image_rows else None
        post_id = bind.execute(
            sa.text(
                """
                INSERT INTO posts (
                    title, slug, summary, content, cover_media_id, category, region,
                    event_date, status, published_at, created_at, updated_at, deleted_at
                )
                VALUES (
                    :title, :slug, :summary, :content, :cover_media_id, 'event', :region,
                    :event_date, :status, :published_at, :created_at, :updated_at, NULL
                )
                RETURNING id
                """
            ),
            {
                "title": event["title"],
                "slug": f"event-{event['date_code']}-{event['id']}",
                "summary": event["description"],
                "content": event["description"] or event["title"],
                "cover_media_id": cover_media_id,
                "region": event["location"],
                "event_date": _parse_event_date(event["date_code"]),
                "status": event["status"],
                "published_at": event["created_at"] if event["status"] == "published" else None,
                "created_at": event["created_at"],
                "updated_at": event["updated_at"],
            },
        ).scalar_one()

        for image in image_rows:
            media_id = media_by_url.get(image["src"])
            if media_id is None:
                continue
            bind.execute(
                sa.text(
                    """
                    INSERT INTO post_media (post_id, media_id, sort_order, caption, created_at)
                    VALUES (:post_id, :media_id, :sort_order, :caption, :created_at)
                    ON CONFLICT (post_id, media_id) DO NOTHING
                    """
                ),
                {
                    "post_id": post_id,
                    "media_id": media_id,
                    "sort_order": image["sort_order"],
                    "caption": image["label"],
                    "created_at": event["created_at"],
                },
            )


def upgrade() -> None:
    if "media" in _tables() and "original_object_key" not in _columns("media"):
        _rename_if_exists("media", "legacy_media")
    if "posts" in _tables() and "cover_media_id" not in _columns("posts"):
        _rename_if_exists("posts", "legacy_posts")
    if "legacy_posts" in _tables():
        for index_name in ("ix_posts_slug", "ix_posts_status", "ix_posts_category", "ix_posts_region", "ix_posts_id"):
            _drop_index_if_exists(index_name)

    _create_users()
    _create_media()
    _create_posts()
    _create_post_indexes()
    _create_post_media()
    _create_audit_logs()

    _migrate_legacy_media()
    _migrate_legacy_posts()
    _migrate_legacy_timeline_events()

    for table_name in ("timeline_event_images", "timeline_events", "legacy_posts", "legacy_media"):
        if table_name in _tables():
            op.drop_table(table_name)


def downgrade() -> None:
    pass

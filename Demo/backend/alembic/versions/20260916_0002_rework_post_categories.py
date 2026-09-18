"""Rework post categories as nullable content categories.

Revision ID: 20260916_0002
Revises: 20260908_0001
Create Date: 2026-09-16

Legacy category values are cleared to NULL because there is no reliable
semantic mapping from the old site-section values to the new content taxonomy.
Downgrade cannot restore the original per-row legacy values after upgrade.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260916_0002"
down_revision = "20260908_0001"
branch_labels = None
depends_on = None


legacy_categories = ("story", "place", "student_work", "event", "achievement")


def upgrade() -> None:
    with op.batch_alter_table("posts") as batch_op:
        batch_op.alter_column(
            "category",
            existing_type=sa.String(length=32),
            nullable=True,
        )

    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE posts
            SET category = NULL
            WHERE category IN :legacy_categories
            """
        ).bindparams(sa.bindparam("legacy_categories", expanding=True)),
        {"legacy_categories": legacy_categories},
    )


def downgrade() -> None:
    # The original legacy category value was intentionally discarded in upgrade,
    # so it cannot be safely restored without inventing per-post classifications.
    # Keep posts.category nullable and preserve all post rows/data.
    pass

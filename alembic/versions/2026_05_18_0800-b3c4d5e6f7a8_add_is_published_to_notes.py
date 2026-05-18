"""add_is_published_to_notes

Revision ID: b3c4d5e6f7a8
Revises: 570123d198fe
Create Date: 2026-05-18 08:00:00.000000

WHY server_default='true' here?
  All existing rows in the notes table were created before this column
  existed. They represent notes that were already visible to students
  (no publish concept existed). Setting server_default='true' makes
  all existing rows become "published" automatically — zero data loss,
  zero student-visible regression. New Python inserts use the model's
  default=False so new uploads start as drafts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = '570123d198fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default='true' backfills all existing rows as published.
    # nullable=False enforces the constraint going forward.
    op.add_column(
        'notes',
        sa.Column(
            'is_published',
            sa.Boolean(),
            nullable=False,
            server_default='true',
        ),
    )


def downgrade() -> None:
    op.drop_column('notes', 'is_published')

"""categories_translated_names

Categories are named and described through the frontend's `TranslatedString`,
and category fields carry a translated name too — but the schema held all
three as a single string (`categories.name` `String(255)`, `categories.description`
`Text`, `category_fields.name` `String(255)`), with nowhere to put a second
locale.

Three columns become JSONB with the `_translations` suffix, matching the
sibling pattern already used by `services.name_translations` and
`warehouse.user_name_translations`:

- `categories.name` → `categories.name_translations` (NOT NULL)
- `categories.description` → `categories.description_translations` (nullable)
- `category_fields.name` → `category_fields.name_translations` (NOT NULL)

Existing values are carried into the `en` locale key; a NULL description
stays NULL rather than becoming `{"en": null}`.

Revision ID: a7c1d4e90b21
Revises: 9c2f5a7b31d4
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a7c1d4e90b21"
down_revision: Union[str, Sequence[str], None] = "9c2f5a7b31d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "categories",
        "name",
        new_column_name="name_translations",
        existing_type=sa.String(255),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="jsonb_build_object('en', name)",
        nullable=False,
        server_default="{}",
    )
    op.alter_column(
        "categories",
        "description",
        new_column_name="description_translations",
        existing_type=sa.Text(),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using=(
            "CASE WHEN description IS NULL THEN NULL "
            "ELSE jsonb_build_object('en', description) END"
        ),
        nullable=True,
        server_default="{}",
    )
    op.alter_column(
        "category_fields",
        "name",
        new_column_name="name_translations",
        existing_type=sa.String(255),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="jsonb_build_object('en', name)",
        nullable=False,
        server_default="{}",
    )


def downgrade() -> None:
    # Reversal is lossy for any non-`en` locale — only `en` survived the trip
    # up, so `en → ru → lt` (same fallback order as `_reconstruct_price_unit`,
    # `get_product_detail/domain.py`) is all the down migration can recover.
    op.alter_column(
        "category_fields",
        "name_translations",
        new_column_name="name",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.String(255),
        postgresql_using=(
            "COALESCE(name_translations ->> 'en', name_translations ->> 'ru', "
            "name_translations ->> 'lt', '')"
        ),
        nullable=False,
        server_default=None,
    )
    op.alter_column(
        "categories",
        "description_translations",
        new_column_name="description",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.Text(),
        postgresql_using=(
            "COALESCE(description_translations ->> 'en', "
            "description_translations ->> 'ru', description_translations ->> 'lt')"
        ),
        nullable=True,
        server_default=None,
    )
    op.alter_column(
        "categories",
        "name_translations",
        new_column_name="name",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        type_=sa.String(255),
        postgresql_using=(
            "COALESCE(name_translations ->> 'en', name_translations ->> 'ru', "
            "name_translations ->> 'lt', '')"
        ),
        nullable=False,
        server_default=None,
    )

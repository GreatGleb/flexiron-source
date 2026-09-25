"""config_field_library_form

Contract `roo_code/roo-context/api/config.md` describes `FieldDefinition.name`
and `FieldDefinition.options` as trilingual (`TranslatedString` /
`TranslatedString[]`), a `hidden` flag on the field, and a `system` flag on
`SectionConfig` — none of which the schema carried. Four columns move:

- `field_definitions.name` (`String(255)`) → `name_translations` (JSONB NOT
  NULL), same treatment as `categories.name` and `category_fields.name` in
  `a7c1d4e90b21_categories_translated_names`: existing values go into the
  `en` locale key.
- `field_definitions.options` (`JSON`, array of plain strings) → JSONB array
  of translation objects, each existing string carried into its own `en` key.
- `field_definitions.hidden` (new, `Boolean NOT NULL DEFAULT false` — "not
  hidden").
- `section_configs.system` (new, `Boolean NOT NULL DEFAULT false` — "not a
  system section").

The unique index `uq_field_definitions_tenant_name` on `(tenant_id, name)`
carries over unchanged onto the renamed, retyped column — same non-decision
the categories revision made when it had no such index to touch: nothing
here adds or drops tenant-scoped name uniqueness, it just follows the column.

Revision ID: d8b3f1c25a60
Revises: b5e2f7a31c40
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d8b3f1c25a60"
down_revision: Union[str, Sequence[str], None] = "f2a7c91d3b04"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "field_definitions",
        "name",
        new_column_name="name_translations",
        existing_type=sa.String(255),
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="jsonb_build_object('en', name)",
        nullable=False,
        server_default="{}",
    )
    # `ALTER COLUMN ... TYPE ... USING` rejects a subquery in the transform
    # expression ("cannot use subquery in transform expression"), and turning
    # a flat array into an array of per-element objects needs `jsonb_agg`
    # over `jsonb_array_elements_text`, which is one. Route around it: a
    # sibling column, a plain `UPDATE` (subqueries are fine there), then swap.
    op.add_column(
        "field_definitions",
        sa.Column("options_translated", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.execute(
        "UPDATE field_definitions SET options_translated = CASE WHEN options IS NULL THEN NULL "
        "ELSE COALESCE("
        "(SELECT jsonb_agg(jsonb_build_object('en', elem)) "
        "FROM jsonb_array_elements_text(options::jsonb) AS elem), "
        "'[]'::jsonb) END"
    )
    op.drop_column("field_definitions", "options")
    op.alter_column("field_definitions", "options_translated", new_column_name="options")
    op.add_column(
        "field_definitions",
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "section_configs",
        sa.Column("system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("section_configs", "system")
    op.drop_column("field_definitions", "hidden")
    op.add_column(
        "field_definitions",
        sa.Column("options_plain", postgresql.JSON(), nullable=True),
    )
    op.execute(
        "UPDATE field_definitions SET options_plain = (CASE WHEN options IS NULL THEN NULL "
        "ELSE COALESCE("
        "(SELECT jsonb_agg(COALESCE(elem ->> 'en', elem ->> 'ru', elem ->> 'lt', '')) "
        "FROM jsonb_array_elements(options) AS elem), "
        "'[]'::jsonb) END)::json"
    )
    op.drop_column("field_definitions", "options")
    op.alter_column("field_definitions", "options_plain", new_column_name="options")
    # Reversal is lossy for any non-`en` locale — same `en → ru → lt` fallback
    # order as `a7c1d4e90b21_categories_translated_names`.
    op.alter_column(
        "field_definitions",
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

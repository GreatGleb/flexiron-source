"""auth_roles_lowercase_and_matrix_default

Two fixes required by roo_code/roo-context/api/00-conventions.md §6.3/§6.4:
lower-case existing role values, and flip role_permissions.can_read's
server_default from true to false (the mock's real default — a new matrix
item is visible to nobody but admin).

Revision ID: c1d2e3f4a5b6
Revises: d41c7a9b5e02
Create Date: 2026-09-25 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "d41c7a9b5e02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE user_roles SET role_name = lower(role_name) WHERE role_name <> lower(role_name)")
    op.execute("UPDATE users SET role = lower(role) WHERE role <> lower(role)")
    op.alter_column(
        "role_permissions",
        "can_read",
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.alter_column(
        "role_permissions",
        "can_read",
        server_default=sa.text("true"),
    )

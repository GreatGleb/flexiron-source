"""Repository for the settings mail slice (Infrastructure / Data Access).

One row per tenant, so there is no list, no pagination and no id in the path.
Every query is scoped by `tenant_id` — there is no other scope this table has.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.shared.models import MailSettings


async def get_mail_settings(db: AsyncSession, tenant_id: UUID) -> MailSettings | None:
    """Read the tenant's mail row — `None` when nothing was ever saved."""
    result = await db.execute(
        select(MailSettings).where(MailSettings.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def upsert_mail_settings(
    db: AsyncSession, tenant_id: UUID, data: dict
) -> MailSettings:
    """Write the tenant's single mail row, creating it on first save."""
    row = await get_mail_settings(db, tenant_id)
    if row is None:
        row = MailSettings(tenant_id=tenant_id, **data)
        db.add(row)
    else:
        for key, value in data.items():
            setattr(row, key, value)
    await db.commit()
    await db.refresh(row)
    return row

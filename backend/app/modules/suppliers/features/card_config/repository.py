"""Repository for the suppliers.card_config read slice (Data Access layer)."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.shared.models import (
    FieldDefinition,
    SectionConfig,
    SectionField,
)


async def list_field_definitions(
    db: AsyncSession, tenant_id: UUID
) -> list[FieldDefinition]:
    """Fetch the tenant's whole field library — no pagination, no filter, no search.

    The library is global per tenant and searched client-side, so the query has
    nothing to narrow beyond the tenant itself.
    """
    result = await db.execute(
        select(FieldDefinition).where(FieldDefinition.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def list_sections(db: AsyncSession, tenant_id: UUID) -> list[SectionConfig]:
    """Fetch the tenant's sections, ordered by `sort_order` ascending.

    The array order is part of the contract, not a nicety: the client reads the
    array top-to-bottom and has no other way to learn the order — `order` rides
    along with the row, but does not order the array by itself. Hence the `ORDER
    BY` lives here, in SQL, and the domain does not re-sort.
    """
    result = await db.execute(
        select(SectionConfig)
        .where(SectionConfig.tenant_id == tenant_id)
        .order_by(SectionConfig.sort_order.asc(), SectionConfig.id.asc())
    )
    return list(result.scalars().all())


async def list_section_fields(
    db: AsyncSession, tenant_id: UUID, section_ids: list[UUID]
) -> list[SectionField]:
    """Fetch the field links of the given sections, each in its own `sort_order`.

    Same rule as `list_sections`: the link order inside a section is what the
    client reads, so it is imposed in SQL. The tenant filter is on the junction
    row itself, not only on the sections fetched before it.
    """
    if not section_ids:
        return []
    result = await db.execute(
        select(SectionField)
        .where(
            SectionField.tenant_id == tenant_id,
            SectionField.section_id.in_(section_ids),
        )
        .order_by(SectionField.sort_order.asc(), SectionField.id.asc())
    )
    return list(result.scalars().all())

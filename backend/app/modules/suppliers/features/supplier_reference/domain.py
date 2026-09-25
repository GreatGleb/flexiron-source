"""Domain use case for Supplier Reference feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.features.supplier_reference.repository import (
    list_suppliers_brief as list_suppliers_brief_repo,
)
from app.modules.suppliers.features.supplier_reference.schemas import SupplierListItem


async def list_suppliers_brief(db: AsyncSession, tenant_id: UUID) -> list[SupplierListItem]:
    """Execute the list suppliers reference use case — id + company, deterministic order."""
    suppliers = await list_suppliers_brief_repo(db, tenant_id)
    return [
        SupplierListItem(id=supplier.id, company=supplier.company_translations)
        for supplier in suppliers
    ]

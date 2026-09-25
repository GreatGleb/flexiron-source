"""Repository for Settings CRUD operations."""

from uuid import UUID

from sqlalchemy import select, update, delete, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.shared.models import (
    CompanyInfo as CompanyInfoModel,
    GlobalConstants as GlobalConstantsModel,
    Currency as CurrencyModel,
    Uom as UomModel,
    UomConversion as UomConversionModel,
    OrderStatusSetting as OrderStatusModel,
)


# ─── Helpers ──────────────────────────────────────────────────────────────

async def get_company(db: AsyncSession, tenant_id: UUID) -> CompanyInfoModel | None:
    result = await db.execute(
        select(CompanyInfoModel).where(CompanyInfoModel.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def patch_company(db: AsyncSession, tenant_id: UUID, data: dict) -> CompanyInfoModel | None:
    stmt = (
        update(CompanyInfoModel)
        .where(CompanyInfoModel.tenant_id == tenant_id)
        .values(**data)
        .returning(CompanyInfoModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_company(db: AsyncSession, tenant_id: UUID, data: dict) -> CompanyInfoModel:
    company = CompanyInfoModel(tenant_id=tenant_id, **data)
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company


# ─── Constants ────────────────────────────────────────────────────────────

async def get_constants(db: AsyncSession, tenant_id: UUID) -> GlobalConstantsModel | None:
    result = await db.execute(
        select(GlobalConstantsModel).where(GlobalConstantsModel.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def patch_constants(db: AsyncSession, tenant_id: UUID, data: dict) -> GlobalConstantsModel | None:
    stmt = (
        update(GlobalConstantsModel)
        .where(GlobalConstantsModel.tenant_id == tenant_id)
        .values(**data)
        .returning(GlobalConstantsModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_constants(db: AsyncSession, tenant_id: UUID, data: dict) -> GlobalConstantsModel:
    obj = GlobalConstantsModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


# ─── Currencies ───────────────────────────────────────────────────────────

async def get_currencies(db: AsyncSession, tenant_id: UUID) -> list[CurrencyModel]:
    result = await db.execute(
        select(CurrencyModel).where(CurrencyModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_currency(
    db: AsyncSession, currency_id: UUID, tenant_id: UUID
) -> CurrencyModel | None:
    """Get a currency owned by this tenant. Foreign rows read as absent."""
    result = await db.execute(
        select(CurrencyModel).where(
            CurrencyModel.id == currency_id,
            CurrencyModel.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def get_currency_by_code(
    db: AsyncSession, tenant_id: UUID, code: str
) -> CurrencyModel | None:
    """Get a currency by code for a tenant (used for duplicate check)."""
    result = await db.execute(
        select(CurrencyModel).where(
            CurrencyModel.tenant_id == tenant_id,
            CurrencyModel.code == code,
        )
    )
    return result.scalar_one_or_none()


async def create_currency(db: AsyncSession, tenant_id: UUID, data: dict) -> CurrencyModel:
    obj = CurrencyModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def clear_default_currency(
    db: AsyncSession, tenant_id: UUID, *, except_id: UUID | None = None
) -> None:
    """Unset `is_default` on every other currency of this tenant — no commit here.

    Deliberately uncommitted: the caller runs this right before the create/update
    that sets the new default, so both writes land in the same transaction (БАГ-09).
    """
    stmt = update(CurrencyModel).where(
        CurrencyModel.tenant_id == tenant_id,
        CurrencyModel.is_default.is_(True),
    )
    if except_id is not None:
        stmt = stmt.where(CurrencyModel.id != except_id)
    await db.execute(stmt.values(is_default=False))


async def patch_currency(
    db: AsyncSession, currency_id: UUID, tenant_id: UUID, data: dict
) -> CurrencyModel | None:
    stmt = (
        update(CurrencyModel)
        .where(
            CurrencyModel.id == currency_id,
            CurrencyModel.tenant_id == tenant_id,
        )
        .values(**data)
        .returning(CurrencyModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_currency(db: AsyncSession, currency_id: UUID, tenant_id: UUID) -> None:
    await db.execute(
        delete(CurrencyModel).where(
            CurrencyModel.id == currency_id,
            CurrencyModel.tenant_id == tenant_id,
        )
    )
    await db.flush()


# ─── UOMs ─────────────────────────────────────────────────────────────────

async def get_uoms(db: AsyncSession, tenant_id: UUID) -> list[UomModel]:
    result = await db.execute(
        select(UomModel).where(UomModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_uom(db: AsyncSession, uom_id: UUID, tenant_id: UUID) -> UomModel | None:
    """Get a UOM owned by this tenant. Foreign rows read as absent."""
    result = await db.execute(
        select(UomModel).where(
            UomModel.id == uom_id,
            UomModel.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def get_uom_by_code(
    db: AsyncSession, tenant_id: UUID, code: str
) -> UomModel | None:
    """Find a UOM whose code_translations contain the given short code in any language."""
    from sqlalchemy import or_
    result = await db.execute(
        select(UomModel).where(
            UomModel.tenant_id == tenant_id,
            or_(
                UomModel.code_translations["en"].as_string() == code,
                UomModel.code_translations["ru"].as_string() == code,
                UomModel.code_translations["lt"].as_string() == code,
            ),
        )
    )
    return result.scalar_one_or_none()


async def create_uom(db: AsyncSession, tenant_id: UUID, data: dict) -> UomModel:
    obj = UomModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def patch_uom(
    db: AsyncSession, uom_id: UUID, tenant_id: UUID, data: dict
) -> UomModel | None:
    stmt = (
        update(UomModel)
        .where(
            UomModel.id == uom_id,
            UomModel.tenant_id == tenant_id,
        )
        .values(**data)
        .returning(UomModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_uom(db: AsyncSession, uom_id: UUID, tenant_id: UUID) -> None:
    await db.execute(
        delete(UomModel).where(
            UomModel.id == uom_id,
            UomModel.tenant_id == tenant_id,
        )
    )
    await db.flush()


# ─── Conversions ──────────────────────────────────────────────────────────

async def get_conversions(db: AsyncSession, tenant_id: UUID) -> list[UomConversionModel]:
    result = await db.execute(
        select(UomConversionModel).where(UomConversionModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_conversion(
    db: AsyncSession, conv_id: UUID, tenant_id: UUID
) -> UomConversionModel | None:
    """Get a conversion rule owned by this tenant. Foreign rows read as absent."""
    result = await db.execute(
        select(UomConversionModel).where(
            UomConversionModel.id == conv_id,
            UomConversionModel.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def get_conversion_by_uom_pair(
    db: AsyncSession, tenant_id: UUID, from_uom_id: UUID, to_uom_id: UUID
) -> UomConversionModel | None:
    """Get a conversion by its UOM pair (used for duplicate check)."""
    result = await db.execute(
        select(UomConversionModel).where(
            UomConversionModel.tenant_id == tenant_id,
            UomConversionModel.from_uom_id == from_uom_id,
            UomConversionModel.to_uom_id == to_uom_id,
        )
    )
    return result.scalar_one_or_none()


async def count_conversions_by_uom(db: AsyncSession, tenant_id: UUID, uom_id: UUID) -> int:
    """Count conversion rules that reference a UOM on either side of the pair."""
    result = await db.execute(
        select(func.count()).where(
            UomConversionModel.tenant_id == tenant_id,
            or_(
                UomConversionModel.from_uom_id == uom_id,
                UomConversionModel.to_uom_id == uom_id,
            ),
        )
    )
    return result.scalar() or 0


async def create_conversion(db: AsyncSession, tenant_id: UUID, data: dict) -> UomConversionModel:
    obj = UomConversionModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def patch_conversion(
    db: AsyncSession, conv_id: UUID, tenant_id: UUID, data: dict
) -> UomConversionModel | None:
    stmt = (
        update(UomConversionModel)
        .where(
            UomConversionModel.id == conv_id,
            UomConversionModel.tenant_id == tenant_id,
        )
        .values(**data)
        .returning(UomConversionModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_conversion(db: AsyncSession, conv_id: UUID, tenant_id: UUID) -> None:
    await db.execute(
        delete(UomConversionModel).where(
            UomConversionModel.id == conv_id,
            UomConversionModel.tenant_id == tenant_id,
        )
    )
    await db.flush()


# ─── Order Statuses ───────────────────────────────────────────────────────

async def get_order_statuses(db: AsyncSession, tenant_id: UUID) -> list[OrderStatusModel]:
    result = await db.execute(
        select(OrderStatusModel)
        .where(OrderStatusModel.tenant_id == tenant_id)
        .order_by(OrderStatusModel.sort_order)
    )
    return list(result.scalars().all())


async def get_order_status(
    db: AsyncSession, status_id: UUID, tenant_id: UUID
) -> OrderStatusModel | None:
    """Get an order status owned by this tenant. Foreign rows read as absent."""
    result = await db.execute(
        select(OrderStatusModel).where(
            OrderStatusModel.id == status_id,
            OrderStatusModel.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def create_order_status(db: AsyncSession, tenant_id: UUID, data: dict) -> OrderStatusModel:
    obj = OrderStatusModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


async def patch_order_status(
    db: AsyncSession, status_id: UUID, tenant_id: UUID, data: dict
) -> OrderStatusModel | None:
    stmt = (
        update(OrderStatusModel)
        .where(
            OrderStatusModel.id == status_id,
            OrderStatusModel.tenant_id == tenant_id,
        )
        .values(**data)
        .returning(OrderStatusModel)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def delete_order_status(db: AsyncSession, status_id: UUID, tenant_id: UUID) -> None:
    await db.execute(
        delete(OrderStatusModel).where(
            OrderStatusModel.id == status_id,
            OrderStatusModel.tenant_id == tenant_id,
        )
    )
    await db.flush()


async def reorder_order_statuses(db: AsyncSession, tenant_id: UUID, ordered_ids: list[str]) -> None:
    """Update sort_order for statuses based on the ordered ID list."""
    for idx, status_id in enumerate(ordered_ids):
        stmt = (
            update(OrderStatusModel)
            .where(
                OrderStatusModel.id == UUID(status_id),
                OrderStatusModel.tenant_id == tenant_id,
            )
            .values(sort_order=idx)
        )
        await db.execute(stmt)
    await db.flush()


# ─── Order Permissions ────────────────────────────────────────────────────

async def get_order_permissions(db: AsyncSession, tenant_id: UUID):
    from app.modules.settings.shared.models import OrderPermissions as OrderPermissionsModel

    result = await db.execute(
        select(OrderPermissionsModel).where(OrderPermissionsModel.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def create_order_permissions(db: AsyncSession, tenant_id: UUID, data: dict):
    from app.modules.settings.shared.models import OrderPermissions as OrderPermissionsModel

    obj = OrderPermissionsModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj

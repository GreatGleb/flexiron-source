"""Repository for Settings CRUD operations."""

from uuid import UUID

from sqlalchemy import select, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.settings.shared.models import (
    CompanyInfo as CompanyInfoModel,
    GlobalConstants as GlobalConstantsModel,
    Currency as CurrencyModel,
    Uom as UomModel,
    UomConversion as UomConversionModel,
    OrderStatusSetting as OrderStatusModel,
)
from app.modules.auth.shared.models import User


# ─── Helpers ──────────────────────────────────────────────────────────────

async def get_tenant_id_for_user(db: AsyncSession, user_id: UUID) -> UUID | None:
    """Get the tenant ID for a given user."""
    result = await db.execute(select(User.tenant_id).where(User.id == user_id))
    return result.scalar_one_or_none()


# ─── Company ──────────────────────────────────────────────────────────────

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
    await db.commit()
    return result.scalar_one_or_none()


async def create_company(db: AsyncSession, tenant_id: UUID, data: dict) -> CompanyInfoModel:
    company = CompanyInfoModel(tenant_id=tenant_id, **data)
    db.add(company)
    await db.commit()
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
    await db.commit()
    return result.scalar_one_or_none()


async def create_constants(db: AsyncSession, tenant_id: UUID, data: dict) -> GlobalConstantsModel:
    obj = GlobalConstantsModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ─── Currencies ───────────────────────────────────────────────────────────

async def get_currencies(db: AsyncSession, tenant_id: UUID) -> list[CurrencyModel]:
    result = await db.execute(
        select(CurrencyModel).where(CurrencyModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_currency(db: AsyncSession, currency_id: UUID) -> CurrencyModel | None:
    result = await db.execute(
        select(CurrencyModel).where(CurrencyModel.id == currency_id)
    )
    return result.scalar_one_or_none()


async def create_currency(db: AsyncSession, tenant_id: UUID, data: dict) -> CurrencyModel:
    obj = CurrencyModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def patch_currency(db: AsyncSession, currency_id: UUID, data: dict) -> CurrencyModel | None:
    stmt = (
        update(CurrencyModel)
        .where(CurrencyModel.id == currency_id)
        .values(**data)
        .returning(CurrencyModel)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


async def delete_currency(db: AsyncSession, currency_id: UUID) -> None:
    await db.execute(delete(CurrencyModel).where(CurrencyModel.id == currency_id))
    await db.commit()


# ─── UOMs ─────────────────────────────────────────────────────────────────

async def get_uoms(db: AsyncSession, tenant_id: UUID) -> list[UomModel]:
    result = await db.execute(
        select(UomModel).where(UomModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_uom(db: AsyncSession, uom_id: UUID) -> UomModel | None:
    result = await db.execute(select(UomModel).where(UomModel.id == uom_id))
    return result.scalar_one_or_none()


async def create_uom(db: AsyncSession, tenant_id: UUID, data: dict) -> UomModel:
    obj = UomModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def patch_uom(db: AsyncSession, uom_id: UUID, data: dict) -> UomModel | None:
    stmt = (
        update(UomModel)
        .where(UomModel.id == uom_id)
        .values(**data)
        .returning(UomModel)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


async def delete_uom(db: AsyncSession, uom_id: UUID) -> None:
    await db.execute(delete(UomModel).where(UomModel.id == uom_id))
    await db.commit()


# ─── Conversions ──────────────────────────────────────────────────────────

async def get_conversions(db: AsyncSession, tenant_id: UUID) -> list[UomConversionModel]:
    result = await db.execute(
        select(UomConversionModel).where(UomConversionModel.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def get_conversion(db: AsyncSession, conv_id: UUID) -> UomConversionModel | None:
    result = await db.execute(
        select(UomConversionModel).where(UomConversionModel.id == conv_id)
    )
    return result.scalar_one_or_none()


async def create_conversion(db: AsyncSession, tenant_id: UUID, data: dict) -> UomConversionModel:
    obj = UomConversionModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def patch_conversion(db: AsyncSession, conv_id: UUID, data: dict) -> UomConversionModel | None:
    stmt = (
        update(UomConversionModel)
        .where(UomConversionModel.id == conv_id)
        .values(**data)
        .returning(UomConversionModel)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


async def delete_conversion(db: AsyncSession, conv_id: UUID) -> None:
    await db.execute(delete(UomConversionModel).where(UomConversionModel.id == conv_id))
    await db.commit()


# ─── Order Statuses ───────────────────────────────────────────────────────

async def get_order_statuses(db: AsyncSession, tenant_id: UUID) -> list[OrderStatusModel]:
    result = await db.execute(
        select(OrderStatusModel)
        .where(OrderStatusModel.tenant_id == tenant_id)
        .order_by(OrderStatusModel.sort_order)
    )
    return list(result.scalars().all())


async def get_order_status(db: AsyncSession, status_id: UUID) -> OrderStatusModel | None:
    result = await db.execute(
        select(OrderStatusModel).where(OrderStatusModel.id == status_id)
    )
    return result.scalar_one_or_none()


async def create_order_status(db: AsyncSession, tenant_id: UUID, data: dict) -> OrderStatusModel:
    obj = OrderStatusModel(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def patch_order_status(db: AsyncSession, status_id: UUID, data: dict) -> OrderStatusModel | None:
    stmt = (
        update(OrderStatusModel)
        .where(OrderStatusModel.id == status_id)
        .values(**data)
        .returning(OrderStatusModel)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.scalar_one_or_none()


async def delete_order_status(db: AsyncSession, status_id: UUID) -> None:
    await db.execute(delete(OrderStatusModel).where(OrderStatusModel.id == status_id))
    await db.commit()


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
    await db.commit()

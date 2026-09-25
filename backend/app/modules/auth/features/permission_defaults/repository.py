"""Repository for permission_defaults feature (Infrastructure / Data Access layer).

Direct table access to `permission_items`, `role_permissions` and
`user_permissions` — the three models the auth domain declares and, until
this slice, nothing in the backend read or wrote.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.shared.models import PermissionItem, RolePermission, UserPermission


async def insert_permission_item(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    item_id: str,
    domain: str,
    item_type: str,
    parent_id: str | None,
    name_translations: dict,
) -> PermissionItem:
    """Insert a new matrix item — no permission rows yet, those follow."""
    item = PermissionItem(
        tenant_id=tenant_id,
        item_id=item_id,
        domain=domain,
        item_type=item_type,
        parent_id=parent_id,
        name_translations=name_translations,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return item


async def list_domain_item_ids(
    db: AsyncSession, *, tenant_id: UUID, domain: str
) -> list[str]:
    """`item_id`s already in this tenant's domain — the 90% rule's denominator."""
    result = await db.execute(
        select(PermissionItem.item_id).where(
            PermissionItem.tenant_id == tenant_id,
            PermissionItem.domain == domain,
        )
    )
    return list(result.scalars().all())


async def list_role_permissions_for_items(
    db: AsyncSession, *, tenant_id: UUID, item_ids: list[str]
) -> list[RolePermission]:
    if not item_ids:
        return []
    result = await db.execute(
        select(RolePermission).where(
            RolePermission.tenant_id == tenant_id,
            RolePermission.item_id.in_(item_ids),
        )
    )
    return list(result.scalars().all())


async def list_user_permissions_for_items(
    db: AsyncSession, *, tenant_id: UUID, item_ids: list[str]
) -> list[UserPermission]:
    if not item_ids:
        return []
    result = await db.execute(
        select(UserPermission).where(
            UserPermission.tenant_id == tenant_id,
            UserPermission.item_id.in_(item_ids),
        )
    )
    return list(result.scalars().all())


async def insert_role_permission(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    item_id: str,
    role: str,
    can_read: bool,
    can_edit: bool,
    can_create: bool,
    can_delete: bool,
) -> RolePermission:
    row = RolePermission(
        tenant_id=tenant_id,
        item_id=item_id,
        role=role,
        can_read=can_read,
        can_edit=can_edit,
        can_create=can_create,
        can_delete=can_delete,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def insert_user_permission(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    item_id: str,
    user_id: UUID,
    can_read: bool,
    can_edit: bool,
    can_create: bool,
    can_delete: bool,
) -> UserPermission:
    row = UserPermission(
        tenant_id=tenant_id,
        item_id=item_id,
        user_id=user_id,
        can_read=can_read,
        can_edit=can_edit,
        can_create=can_create,
        can_delete=can_delete,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row

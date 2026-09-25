"""Audit Internal Service API — public contract for cross-module calls.

The nine domain modules that own audited entities MUST write to the shared
journal, read it back for one entity and clean up after a deleted entity
only through these functions. They MUST NOT import
`app.modules.audit.shared.models` directly.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.shared.models import AUDIT_ENTITY_TYPES, AuditEntry


def _ensure_known_entity_type(entity_type: str) -> None:
    if entity_type not in AUDIT_ENTITY_TYPES:
        raise ValueError(f"Unknown audit entity type: {entity_type!r}")


async def write_audit_entry(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    entity_type: str,
    entity_id: UUID,
    user_id: UUID | None,
    user_name_translations: dict[str, Any],
    user_initials: str,
    property_translations: dict[str, Any],
    old_value: str,
    new_value: str,
    sensitive: str | None = None,
) -> AuditEntry:
    """Append one row to the shared journal."""
    _ensure_known_entity_type(entity_type)
    entry = AuditEntry(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        user_name_translations=user_name_translations,
        user_initials=user_initials,
        property_translations=property_translations,
        old_value=old_value,
        new_value=new_value,
        sensitive=sensitive,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def read_audit_entries_for_entity(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> list[AuditEntry]:
    """One entity's journal rows for one tenant, newest first.

    Ties in `timestamp` break on `id` descending: the primary key is
    UUIDv7, so it sorts the same way insertion order does. Read-only —
    creates, changes or removes nothing.
    """
    result = await db.execute(
        select(AuditEntry)
        .where(
            AuditEntry.tenant_id == tenant_id,
            AuditEntry.entity_type == entity_type,
            AuditEntry.entity_id == entity_id,
        )
        .order_by(AuditEntry.timestamp.desc(), AuditEntry.id.desc())
    )
    return list(result.scalars().all())


async def delete_audit_entries_for_entity(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    entity_type: str,
    entity_id: UUID,
) -> None:
    """Remove every journal row for one entity of one tenant.

    Called when the entity itself is deleted, so the feed never points at a
    card that no longer exists.
    """
    _ensure_known_entity_type(entity_type)
    await db.execute(
        delete(AuditEntry).where(
            AuditEntry.tenant_id == tenant_id,
            AuditEntry.entity_type == entity_type,
            AuditEntry.entity_id == entity_id,
        )
    )
    await db.flush()


async def delete_audit_entry(
    db: AsyncSession,
    *,
    tenant_id: UUID,
    entry_id: UUID,
) -> bool:
    """Remove one journal row by its id, scoped to one tenant.

    Returns whether a row was found and removed.
    """
    result = await db.execute(
        delete(AuditEntry).where(
            AuditEntry.tenant_id == tenant_id,
            AuditEntry.id == entry_id,
        )
    )
    await db.flush()
    return result.rowcount > 0

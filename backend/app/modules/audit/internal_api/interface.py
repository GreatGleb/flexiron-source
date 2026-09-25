"""Audit Internal Service API — public contract for cross-module calls.

The nine domain modules that own audited entities MUST write to the shared
journal and clean up after a deleted entity only through these two
functions. They MUST NOT import `app.modules.audit.shared.models` directly.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.audit.shared.models import AuditEntry


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
    await db.execute(
        delete(AuditEntry).where(
            AuditEntry.tenant_id == tenant_id,
            AuditEntry.entity_type == entity_type,
            AuditEntry.entity_id == entity_id,
        )
    )
    await db.flush()

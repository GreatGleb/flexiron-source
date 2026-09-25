"""Cross-cutting file upload service.

This module provides shared file operations used by all business modules.
It is NOT a business module — it's infrastructure (cross-cutting concern).
"""

from typing import BinaryIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.uploads.models import UploadedFile


async def store_file(
    db: AsyncSession,
    tenant_id: str,
    original_name: str,
    storage_path: str,
    size: int,
    mime: str,
    uploaded_by: str | None = None,
    is_draft: bool = True,
) -> UploadedFile:
    """Store a new uploaded file record."""
    file_record = UploadedFile(
        tenant_id=tenant_id,
        original_name=original_name,
        storage_path=storage_path,
        size=size,
        mime=mime,
        uploaded_by=uploaded_by,
        is_draft=is_draft,
    )
    db.add(file_record)
    await db.flush()
    return file_record


async def get_file_by_id(
    db: AsyncSession, tenant_id: str, file_id: str
) -> UploadedFile | None:
    """Retrieve a file record by ID, inside its own tenant.

    ``tenant_id`` is a required parameter with no default, and it is part of the
    query rather than a check after the fact.  A caller that forgets the tenant
    therefore fails at the call site with ``TypeError`` instead of being handed
    another tenant's file.
    """
    result = await db.execute(
        select(UploadedFile).where(
            UploadedFile.id == file_id,
            UploadedFile.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none()


async def delete_file(db: AsyncSession, tenant_id: str, file_id: str) -> bool:
    """Delete a file record (soft-aware), inside its own tenant.

    The record is looked up tenant-scoped, so another tenant's file reads as
    absent and cannot be deleted.  ``tenant_id`` is required for the same
    reason as in :func:`get_file_by_id`.
    """
    file_record = await get_file_by_id(db, tenant_id, file_id)
    if file_record is None:
        return False
    await db.delete(file_record)
    return True

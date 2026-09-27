"""Domain use cases for the suppliers.card_config read slice.

Pure assembly — no HTTP, no session management. Ordering is not repeated here:
both arrays arrive from the repository already ordered by `sort_order`, and a
second `sorted()` in this file would be the second instance of one rule.
"""

from collections import defaultdict
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.suppliers.shared.models import (
    FieldDefinition,
    SectionConfig,
    SectionField,
)

from .repository import list_field_definitions, list_section_fields, list_sections
from .schemas import FieldDefinitionItem, SectionConfigItem, SectionFieldItem


def _to_field_item(entity: FieldDefinition) -> FieldDefinitionItem:
    """One library row on the wire — `field_type` becomes `type`, `is_builtin` is dropped.

    `is_builtin` is deliberately not carried: the contract lists the response
    fields by name, and that flag is not one of them, so which marker is the real
    one stays the owner's open decision and does not leak into this shape.
    """
    return FieldDefinitionItem(
        id=entity.id,
        name=entity.name_translations,
        type=entity.field_type,
        required=entity.required,
        usageCount=entity.usage_count,
        hidden=entity.hidden,
        options=entity.options,
    )


def _to_section_item(
    section: SectionConfig, links: list[SectionField]
) -> SectionConfigItem:
    """One section on the wire — `sort_order` becomes `order`, links keep their own."""
    return SectionConfigItem(
        id=section.id,
        name=section.name_translations,
        order=section.sort_order,
        collapsed=section.collapsed,
        visible=section.visible,
        system=section.system,
        fields=[
            SectionFieldItem(
                fieldId=link.field_id,
                order=link.sort_order,
                visible=link.visible,
            )
            for link in links
        ],
    )


async def get_field_library(
    db: AsyncSession, tenant_id: UUID
) -> list[FieldDefinitionItem]:
    """Assemble the tenant's field library as contract items."""
    entities = await list_field_definitions(db, tenant_id)
    return [_to_field_item(entity) for entity in entities]


async def get_sections(db: AsyncSession, tenant_id: UUID) -> list[SectionConfigItem]:
    """Assemble the tenant's card sections, each with the fields it carries."""
    sections = await list_sections(db, tenant_id)
    links = await list_section_fields(
        db, tenant_id, [section.id for section in sections]
    )

    links_by_section: dict[UUID, list[SectionField]] = defaultdict(list)
    for link in links:
        links_by_section[link.section_id].append(link)

    return [
        _to_section_item(section, links_by_section[section.id])
        for section in sections
    ]

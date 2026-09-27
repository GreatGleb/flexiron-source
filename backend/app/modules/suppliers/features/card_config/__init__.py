"""Card config read feature slice — the field library and the card sections."""

from app.modules.suppliers.features.card_config.action import (
    get_field_library,
    get_sections,
    router,
)

__all__ = ["get_field_library", "get_sections", "router"]

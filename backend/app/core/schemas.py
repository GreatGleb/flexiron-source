from pydantic import BaseModel
from typing import Any, Generic, TypeVar


class TranslatedString(BaseModel):
    """Locale-keyed string. Any key = language code (ru, en, lt, de, fr, etc.)."""

    ru: str = ""
    en: str = ""
    lt: str = ""

    # Allow dynamic locale keys beyond the three defaults
    model_config = {"extra": "allow"}


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated list response — items + pagination metadata."""

    items: list[T]
    total: int
    page: int
    pageSize: int
    totalPages: int


class ApiResponse(BaseModel):
    """Generic API response envelope."""

    success: bool = True
    data: Any | None = None
    message: str | None = None
    code: str | None = None

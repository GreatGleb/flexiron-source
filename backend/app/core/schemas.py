from pydantic import BaseModel
from typing import Generic, TypeVar


class TranslatedString(BaseModel):
    """Locale-keyed string. Any key = language code (ru, en, lt, de, fr, etc.)."""

    ru: str = ""
    en: str = ""
    lt: str = ""

    # Allow dynamic locale keys beyond the three defaults
    model_config = {"extra": "allow"}


T = TypeVar("T")


class PaginatedResponse(BaseModel):
    """Paginated list response — items + pagination metadata."""

    items: list
    total: int
    page: int
    pageSize: int
    totalPages: int


class ApiResponse(BaseModel):
    """Generic API response envelope."""

    success: bool = True
    data: dict | None = None
    message: str | None = None
    code: str | None = None

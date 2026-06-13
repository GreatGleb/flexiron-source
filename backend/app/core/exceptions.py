"""Global custom exceptions for the Flexiron ERP backend."""


class AppError(Exception):
    """Base application error."""

    def __init__(self, message: str, code: str | None = None) -> None:
        self.message = message
        self.code = code
        super().__init__(message)


class NotFoundError(AppError):
    """Raised when a requested entity is not found."""

    def __init__(self, entity: str, entity_id: str | None = None) -> None:
        msg = f"{entity} not found"
        if entity_id:
            msg += f": {entity_id}"
        super().__init__(msg, code="NOT_FOUND")


class ValidationError(AppError):
    """Raised when input data fails validation."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="VALIDATION_ERROR")


class UnauthorizedError(AppError):
    """Raised when authentication is required."""

    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, code="UNAUTHORIZED")


class ForbiddenError(AppError):
    """Raised when the user lacks permission."""

    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, code="FORBIDDEN")


class ConflictError(AppError):
    """Raised when a conflict occurs (e.g., duplicate entry)."""

    def __init__(self, message: str) -> None:
        super().__init__(message, code="CONFLICT")

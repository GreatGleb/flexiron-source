from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.exceptions import (
    AppError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.core.middleware.cors import setup_cors

# ── Route imports from module features ──
from app.modules.products.features.list_products.action import (
    router as products_list_router,
)
from app.modules.products.features.get_product_detail.action import (
    router as products_get_detail_router,
)
from app.modules.products.features.create_product.action import (
    router as products_create_router,
)
from app.modules.products.features.patch_product.action import (
    router as products_patch_router,
)
from app.modules.auth.features.me.action import (
    router as auth_me_router,
)
from app.modules.auth.features.login.action import (
    router as auth_login_router,
)
from app.modules.auth.features.register.action import (
    router as auth_register_router,
)
from app.modules.auth.features.magic_link.action import (
    router as auth_magic_link_router,
)
from app.modules.settings.features.profile.action import (
    router as settings_profile_router,
)
from app.modules.settings.features.crud.action import (
    router as settings_crud_router,
)
from app.modules.settings.features.mail.action import (
    router as settings_mail_router,
)
from app.modules.settings.features.warehouse_map.action import (
    router as settings_warehouse_map_router,
)
from app.modules.finance.features.payments.action import (
    router as finance_payments_router,
)
from app.modules.warehouse.features.list_batches.action import (
    router as warehouse_list_batches_router,
)
from app.modules.warehouse.features.list_movements.action import (
    router as warehouse_list_movements_router,
)
from app.modules.clients.features.read_clients.action import (
    router as clients_read_router,
)
from app.modules.notifications.features.feed.action import (
    router as notifications_feed_router,
)
from app.modules.suppliers.features.supplier_reference.action import (
    router as suppliers_reference_router,
)
from app.modules.finance.features.archive.action import (
    router as finance_archive_router,
)
from app.modules.products.features.archive_product.action import (
    router as products_archive_router,
)
from app.core.uploads.action import (
    router as uploads_router,
)
from app.modules.products.features.list_categories.action import (
    router as products_list_categories_router,
)
from app.modules.services.features.catalog.action import (
    router as services_catalog_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle — startup / shutdown."""
    # Startup: database engine is lazy, no explicit connect needed
    yield
    # Shutdown: dispose engine
    from app.core.database import engine

    await engine.dispose()


app = FastAPI(
    title="Flexiron ERP API",
    version="0.1.0",
    lifespan=lifespan,
)


# ── Domain refusals answer with their own status, never a 500 (BAG-11) ──
# The machine code travels in `detail.code` and is read by the frontend
# (`errorCode()`, `services/apiErrorCode.ts`); the status is a property of the
# exception class, so a domain code raised as one of these five is answered
# correctly without touching this table. Registered on the base class: Starlette
# matches handlers by the exception's MRO.
_APP_ERROR_STATUS: tuple[tuple[type[AppError], int], ...] = (
    (NotFoundError, 404),
    (ValidationError, 422),
    (UnauthorizedError, 401),
    (ForbiddenError, 403),
    (ConflictError, 409),
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Turn a raised `AppError` into an HTTP answer carrying its domain code."""
    status_code = next(
        (code for kind, code in _APP_ERROR_STATUS if isinstance(exc, kind)), 500
    )
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"message": exc.message, "code": exc.code}},
    )


# CORS
setup_cors(app)

# ── Static files: serve uploaded files ──
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Include feature routers ──
# `list_products` MUST be registered before `get_product_detail`: the latter's
# `/{product_id}` segment is typed UUID and would otherwise capture `/list`.
app.include_router(products_list_router)
app.include_router(products_get_detail_router)
app.include_router(products_create_router)
app.include_router(products_patch_router)
app.include_router(auth_me_router)
app.include_router(settings_profile_router)
app.include_router(settings_crud_router)
app.include_router(settings_mail_router)
app.include_router(settings_warehouse_map_router)
app.include_router(finance_payments_router)
app.include_router(finance_archive_router)
app.include_router(notifications_feed_router)
# `supplier_reference` (`/list`) регистрируется раньше любого будущего
# `/{supplier_id}`: UUID-типизированный роут карточки иначе перехватил бы сегмент
# `/list` — то же правило, что у `products_list_router`.
app.include_router(suppliers_reference_router)
app.include_router(warehouse_list_batches_router)
app.include_router(warehouse_list_movements_router)
app.include_router(clients_read_router)
app.include_router(auth_login_router)
app.include_router(auth_register_router)
app.include_router(auth_magic_link_router)
app.include_router(uploads_router)
app.include_router(products_list_categories_router)
app.include_router(products_archive_router)
app.include_router(services_catalog_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


from app.modules.audit.features.feed.action import (  # noqa: E402
    router as audit_feed_router,
)

app.include_router(audit_feed_router)

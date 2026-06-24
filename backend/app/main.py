from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.middleware.cors import setup_cors

# ── Route imports from module features ──
from app.modules.products.features.get_product_detail.action import (
    router as products_get_detail_router,
)
from app.modules.products.features.create_product.action import (
    router as products_create_router,
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
from app.core.uploads.action import (
    router as uploads_router,
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

# CORS
setup_cors(app)

# ── Static files: serve uploaded files ──
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ── Include feature routers ──
app.include_router(products_get_detail_router)
app.include_router(products_create_router)
app.include_router(auth_me_router)
app.include_router(settings_profile_router)
app.include_router(settings_crud_router)
app.include_router(auth_login_router)
app.include_router(auth_register_router)
app.include_router(auth_magic_link_router)
app.include_router(uploads_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}

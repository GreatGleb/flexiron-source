import importlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
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

def discover_feature_routers() -> list[APIRouter]:
    """Find every module-level `router: APIRouter` under `app/**/action.py`.

    A hand-written import per feature (and a hand-written `include_router` to match)
    makes this file co-owned by every feature at once — two features can't be added
    independently without both touching the same lines. Walking the tree instead
    means a new `action.py` registers itself.

    Registration order is a rule, not a memory: among routers that could collide on a
    shared prefix, the router with no `{param}` segment in any of its paths goes first
    — a literal path like `/list` must never be captured by a neighboring `/{id}`.
    Beyond that, order is the router's own file path, so two runs always agree.
    """
    app_dir = Path(__file__).resolve().parent
    repo_root = app_dir.parent

    discovered: list[tuple[Path, APIRouter]] = []
    for path in sorted(app_dir.rglob("action.py")):
        dotted = ".".join(path.relative_to(repo_root).with_suffix("").parts)
        module = importlib.import_module(dotted)
        router = getattr(module, "router", None)
        if isinstance(router, APIRouter):
            discovered.append((path, router))

    def has_param_path(router: APIRouter) -> bool:
        return any("{" in route.path for route in router.routes)

    discovered.sort(key=lambda item: (has_param_path(item[1]), str(item[0])))
    return [router for _, router in discovered]


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
# Discovered by walking `app/**/action.py` — see `discover_feature_routers()` for the
# ordering rule (literal paths before `{param}` paths on a shared prefix).
for feature_router in discover_feature_routers():
    app.include_router(feature_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


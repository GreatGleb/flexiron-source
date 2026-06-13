---
name: create-api-feature
description: Generate a complete FastAPI backend feature following Modular Monolith + Vertical Slice Architecture — from schemas → repository → domain → action, within an existing module.
user_invocable: true
arguments:
  - name: module
    description: "Module name (e.g., products, suppliers, warehouse, finance, auth, bcc, notifications, settings, analytics, billing, services)"
    required: true
  - name: feature
    description: "Feature name in snake_case (e.g., create_batch, get_product_detail, patch_supplier, list_movements, upload_document). This becomes the feature folder name."
    required: true
---

# Create API Feature — Modular Monolith + Vertical Slice Architecture

Build a complete backend feature inside [`app/modules/[module]/features/[feature]/`](backend/app/modules/). Each feature is a **Vertical Slice** — a self-contained slice through all layers (schemas → repository → domain → action).

## Architecture Overview

```
backend/
├── alembic/                              # Migrations in repo root
│   ├── _alembic_imports.py               # Model registry (add new models here)
│   └── versions/                         # Migration files
├── app/
│   ├── main.py                           # Entry point — register feature routers
│   ├── core/                             # 🧊 STERILE — infrastructure only
│   │   ├── base.py                       # Base, UUIDMixin, TimestampMixin
│   │   ├── config.py                     # Settings (pydantic-settings)
│   │   ├── database.py                   # get_db() async session factory
│   │   ├── exceptions.py                 # AppError, NotFoundError, ValidationError, etc.
│   │   ├── schemas.py                    # ApiResponse, PaginatedResponse, TranslatedString
│   │   ├── middleware/
│   │   └── uploads/                      # File upload service
│   └── modules/                          # Business modules (see below)
│       ├── __init__.py
│       ├── [module]/
│       │   ├── __init__.py
│       │   ├── features/                 # Vertical slices
│       │   │   ├── __init__.py
│       │   │   └── [feature]/            # ← YOU ARE HERE
│       │   │       ├── action.py         # FastAPI route handler (Presenter)
│       │   │       ├── domain.py         # Business logic / Use Case
│       │   │       ├── repository.py     # Data access (SQL)
│       │   │       ├── schemas.py        # Pydantic DTOs (Input / Response)
│       │   │       ├── validators.py     # [optional] complex validation logic
│       │   │       ├── helpers.py        # [optional] helper functions
│       │   │       └── .../              # [optional] subfolders for parsers/custom services
│       │   ├── internal_api/
│       │   │   └── interface.py          # 🚫 Cross-module contract ONLY
│       │   └── shared/
│       │       ├── __init__.py
│       │       ├── models.py             # SQLAlchemy ORM models
│       │       └── dependencies.py       # Module DI
```

## Core Principles

### 1. Modular Monolith — Module Isolation
- **`app/core/` is sterile.** It contains ZERO business logic — only shared infrastructure (`config`, `database`, `base`, `exceptions`, `schemas`, `uploads`).
- **All business logic lives in `app/modules/[module]/features/[feature]/`.**
- Each module is a bounded context. It owns its data, its models, and its logic.

### 2. Vertical Slice — Feature Ownership
- Each feature folder (`features/[feature]/`) owns its own:
  - **Schemas** — request/response DTOs
  - **Repository** — how to read/write data
  - **Domain** — business rules and orchestration
  - **Action** — HTTP adapter (route handler)
- A feature = one endpoint OR a tightly coupled group of endpoints (e.g., `create_batch` = POST, `list_batches` = GET list).

### 3. 🚫 No Direct Cross-Module Imports
- Module A MUST NOT import from `app/modules/b/...` directly.
- If module A needs data from module B, it calls [`module/b/internal_api/interface.py`](backend/app/modules/products/internal_api/interface.py).
- The `internal_api/interface.py` re-exports feature repository functions publicly.
- ⚠️ If the required function doesn't exist in `internal_api/interface.py`, **create it there first** — do NOT bypass the interface.

### 4. Relative Imports Within Feature
- Inside `features/[feature]/`, use **relative imports**:
  ```python
  from .domain import my_usecase
  from .schemas import MyInput, MyResponse
  from .repository import my_repo_function
  ```
- Outside the feature (e.g., `action.py` importing `domain.py`), use **absolute imports** from the module root:
  ```python
  from app.modules.[module].features.[feature].domain import ...
  ```

### 5. JSONB Multilingual Approach
- Translated fields use **JSONB** columns named `{field}_translations`.
  - ✅ `name_translations` (JSONB: `{"ru": "...", "en": "...", "lt": "..."}`)
  - ❌ NOT `name_ru`, `name_en`, `name_lt` (three separate columns)
- The [`TranslatedString`](backend/app/core/schemas.py:5) Pydantic model maps directly to/from JSONB dict.
- SQLAlchemy models store translations as `Mapped[dict]` with JSONB type.

### 6. 🧩 Flexibility & Readability (CRITICAL — Not a Dogma)
> The 4-file pattern (`action.py`, `domain.py`, `repository.py`, `schemas.py`) is the **starting point**, not a straitjacket.

If business logic is complex, **DECOMPOSE** into additional files and subfolders:
- `validators.py` — complex input validation / cross-field checks
- `helpers.py` — pure helper functions
- `parsers/` — subfolder for file parsers (CSV, XML, Excel)
- `services/` — subfolder for composite business services
- `strategies/` — subfolder for strategy pattern implementations

**Clean code, clear abstractions, and readability always win over strict file count.**

### 7. Alembic & Model Registry
- Migrations live in [`backend/alembic/`](backend/alembic/) — NOT inside `app/`.
- To register new ORM models for Alembic detection, add imports to [`backend/alembic/_alembic_imports.py`](backend/alembic/_alembic_imports.py).
- Models go in `app/modules/[module]/shared/models.py`.

---

## CRITICAL RULES

1. **Read first** — before writing code, read:
   - The API contract for this domain (if exists)
   - The ORM model in `app/modules/[module]/shared/models.py`
   - The `internal_api/interface.py` for this module (if it already exists)
   - Existing feature examples in the same module for style consistency
2. **Analyze** — determine feature pattern (see table below)
3. **STOP after each file** — wait for confirmation before proceeding
4. **typecheck** — run `python -c "from app.modules.[module].features.[feature].* import ..."` after each file
5. **ALWAYS create `__init__.py`** in any new package directory with proper `__all__` exports
6. **Register router** in [`app/main.py`](backend/app/main.py) — import and `app.include_router()`

---

## Feature Pattern Classification

Before writing code, classify the feature into one of these patterns:

| Pattern | Description | Endpoint Shape | Example |
|---------|-------------|---------------|---------|
| **Simple CRUD Create** | POST to create an entity | `POST /api/[domain]` | [`create_product`](backend/app/modules/products/features/create_product/) |
| **Simple CRUD Get** | GET single entity by ID | `GET /api/[domain]/{id}` | [`get_product_detail`](backend/app/modules/products/features/get_product_detail/) |
| **Simple CRUD List** | GET paginated list | `GET /api/[domain]` | — |
| **Simple CRUD Patch** | PATCH partial update | `PATCH /api/[domain]/{id}` | — |
| **Simple CRUD Delete** | DELETE entity | `DELETE /api/[domain]/{id}` | — |
| **Action** | POST to trigger a process | `POST /api/[domain]/action` | bcc/send, exports |
| **Singleton Get** | GET single row per tenant | `GET /api/[domain]` | settings/company |
| **Singleton Patch** | PATCH/upsert single row | `PATCH /api/[domain]` | settings/company |
| **Bulk Replace** | PUT full array replace | `PUT /api/[domain]` | config/sections |
| **CSV Export** | Streaming CSV response | `GET /api/[domain]/export.csv` | suppliers/export |
| **Upload** | Multipart file upload | `POST /api/uploads` | uploads |

**A feature can combine patterns** (e.g., `create_batch` could be a POST that also validates stock constraints = Create + business logic).

---

## Step 0: Analysis & Preflight

### Read these files first:

```
1. app/modules/[module]/shared/models.py         — ORM models for this module
2. app/modules/[module]/internal_api/interface.py — existing cross-module contracts
3. app/modules/[module]/features/                 — existing features for style reference
4. app/core/schemas.py                             — ApiResponse, PaginatedResponse, TranslatedString
5. app/core/exceptions.py                          — AppError subclasses
```

### 🔍 Step 0a — SQL Model Audit (contract vs model gap analysis)

Before writing code, verify the ORM model matches what the feature needs:

```md
# SQL Model Audit — [Module].[Feature]

## 1. All required fields exist in the model?
| Field needed | DB column ✅/❌ | Type | Nullable |
|---|---|---|---|
| id | ✅ | UUID(as_uuid=True) | PK |
| name_translations | ✅/❌ | JSONB | — |
| status | ✅ | String(50) | NOT NULL |

## 2. JSONB translations: correct prefix?
- [ ] `{field}_translations` exists for each TranslatedString field
- [ ] Prefix matches the field name (e.g., `company` → `company_translations`)

## 3. Relationships exist if needed?
- [ ] Foreign keys and relationships defined
- [ ] cascade configured correctly

## 4. Indexes on filter/search fields?
- [ ] tenant_id always has index
- [ ] Fields used in WHERE/ORDER BY have indexes
```

**If gaps found:**
1. Note them in ADR-0
2. Create Alembic revision: `cd backend && alembic revision -m "fix_[module]_[feature]_gaps"`
3. Update model in `app/modules/[module]/shared/models.py`
4. Add new model import to [`backend/alembic/_alembic_imports.py`](backend/alembic/_alembic_imports.py)
5. Apply: `alembic upgrade head`
6. Only then proceed

### 🔍 Step 0b — Internal API Check

If this feature needs data from **another module**:
```
1. Check if the needed function exists in that module's internal_api/interface.py
2. If NOT: add it there first (re-export from the feature's repository)
3. NEVER import from another module's features/ or shared/ directly
```

### ADR-0: Feature Architecture Decision

Output before writing any code:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-0: [Module].[Feature] — Feature Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pattern: [Create | Get | List | Patch | Delete | Action | Singleton | Bulk Replace | CSV | Upload]
Endpoint: [METHOD /api/[domain]/[path]]

Context:
- [What this feature does — 1-2 sentences]
- [Which ORM model(s) it uses]
- [Complexities: TranslatedString, relationships, computed fields, cross-module calls]
- [SQL model audit: N gaps found / no gaps]

Decision:
- Files needed: action.py, domain.py, repository.py, schemas.py
- [Additional files if complex: validators.py, helpers.py, subfolders]
- [Cross-module calls via: internal_api/interface.py]
- [Special handling: PATCH merge, Idempotency-Key, CSV streaming, tenant-scoping]

Consequences:
- [Positive: isolation, testability]
- [Trade-off: complexity, duplication]

Affected files:
- app/modules/[module]/features/[feature]/action.py
- app/modules/[module]/features/[feature]/domain.py
- app/modules/[module]/features/[feature]/repository.py
- app/modules/[module]/features/[feature]/schemas.py
- app/main.py (register router)
- [Optional: alembic/_alembic_imports.py, internal_api/interface.py]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

```
⏸ STOP — Step 0: Analysis
Done: contract & model read, pattern classified, ADR-0 output
Next: Step 1 — Schemas (Pydantic DTOs)
Continue?
```

---

## Step 1: Pydantic Schemas (DTO Layer)

### ADR-1: Schema Design

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-1: [Module].[Feature] — Schema Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context:
- Feature uses JSONB-translated fields: [YES / NO]
- Input shapes: [what fields from request]
- Response shape: [what fields returned]
- Wrapped in ApiResponse envelope

Decision:
- Input schema: [Name]Input (BaseModel)
- Response schema: [Name]Response (BaseModel)
- TranslatedString from app.core.schemas for multi-lang fields
- model_config = ConfigDict(from_attributes=True) for Response schemas
- model_dump(mode="json") when building ApiResponse (produces JSON-safe types)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `app/modules/[module]/features/[feature]/schemas.py`

**Template for Create feature:**

```python
"""Schemas for [Feature] feature (Responder / Boundary layer)."""

from pydantic import BaseModel
from uuid import UUID
from typing import Any


class [FeatureName]Input(BaseModel):
    """Input for creating a new [entity]."""

    # Required fields
    name: str
    # Optional fields with defaults
    description: str | None = None
    # TranslatedString fields (JSONB approach):
    # name_translations: TranslatedString  # if multi-lang
    # ... other fields from contract


class [FeatureName]Response(BaseModel):
    """Response after [action]."""

    id: UUID
    name: str
    # ... all needed fields

    model_config = {"from_attributes": True}
```

**Template for List feature:**

```python
"""Schemas for [Feature] feature."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class [Entity]ListItem(BaseModel):
    """Row in the list endpoint — subset of fields."""

    id: UUID
    # ... list-specific fields

    model_config = {"from_attributes": True}


class [Entity]ListResponse(BaseModel):
    """Paginated list response (used internally, wrapped in ApiResponse)."""

    items: list[[Entity]ListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
```

**Template for Get feature:**

```python
"""Schemas for [Feature] feature."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class [Entity]DetailResponse(BaseModel):
    """Full entity detail response."""

    id: UUID
    # ... all fields matching API contract
    # Nested relationships as lists of sub-schemas
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

**Template for Patch/Update feature:**

```python
"""Schemas for [Feature] feature."""

from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class [Entity]PatchInput(BaseModel):
    """Body for PATCH — partial update (dirty-only fields).

    All fields are Optional — client sends only changed fields.
    """

    name: Optional[str] = None
    # All fields as Optional[...] | None
    # TranslatedString fields:
    # name_translations: Optional[TranslatedString] = None


class [Entity]PatchResponse(BaseModel):
    """Full entity after patch."""

    id: UUID
    name: str
    # ... all fields

    model_config = {"from_attributes": True}
```

**Template for features with TranslatedString (JSONB approach):**

```python
"""Schemas for [Feature] feature."""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from app.core.schemas import TranslatedString


class [Entity]ListItem(BaseModel):
    """Row in list — includes translated fields mapped via JSONB."""

    id: UUID
    name_translations: TranslatedString  # JSONB → TranslatedString

    model_config = {"from_attributes": True}
```

### Checkpoint 1

```bash
cd backend && python -c "from app.modules.[module].features.[feature].schemas import *; print('OK')"
```

```
⏸ STOP — Step 1: Schemas
Done: feature schemas created, import check ✅
Next: Step 2 — Repository Layer
Continue?
```

---

## Step 2: Repository Layer (Data Access)

### ADR-2: Repository Pattern

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-2: [Module].[Feature] — Repository Pattern
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context:
- SQLAlchemy async session injected via get_db()
- Multi-tenant: ALL queries MUST filter by tenant_id
- Model(s): [list of tables used]
- Operations needed: [list of DB operations]

Decision:
- Repository = standalone async functions (not a class)
- Each function takes `db: AsyncSession` as first param
- tenant_id passed explicitly as parameter
- Repository NEVER does business logic — pure data access
- Uses session.execute(), select(), flush(), refresh()
- Returns ORM models (not schemas) — mapping happens in domain layer

Consequences:
+ Simple, stateless functions — easy to test
+ Tenant isolation explicit in every query
+ Can be re-exported via internal_api/interface.py for cross-module use
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `app/modules/[module]/features/[feature]/repository.py`

**Template for Create feature:**

```python
"""Repository for [Feature] feature (Infrastructure / Data Access layer)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[module].shared.models import [EntityModel]


async def create_[entity](
    db: AsyncSession,
    tenant_id: UUID,
    name: str,
    # ... other fields as keyword arguments
) -> [EntityModel]:
    """Insert a new [entity] into the database."""
    entity = [EntityModel](
        tenant_id=tenant_id,
        name=name,
        # ... map fields
    )
    db.add(entity)
    await db.flush()
    await db.refresh(entity)
    return entity
```

**Template for Get feature:**

```python
"""Repository for [Feature] feature."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.[module].shared.models import [EntityModel]


async def get_[entity]_by_id(
    db: AsyncSession, entity_id: UUID, tenant_id: UUID
) -> [EntityModel] | None:
    """Fetch a [entity] by its ID and tenant_id, with relationships loaded."""
    result = await db.execute(
        select([EntityModel])
        .where(
            [EntityModel].id == entity_id,
            [EntityModel].tenant_id == tenant_id,
        )
        # .options(selectinload([EntityModel].related_field))  # if relationships needed
    )
    return result.scalar_one_or_none()
```

**Template for List feature (paginated, tenant-scoped):**

```python
"""Repository for [Feature] feature."""

from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[module].shared.models import [EntityModel]


async def list_[entities](
    db: AsyncSession,
    tenant_id: UUID,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    sort_by: str | None = "created_at",
    sort_desc: bool = True,
    **filters,
) -> tuple[list[[EntityModel]], int]:
    """List [entities] with pagination and filtering, tenant-scoped."""
    query = select([EntityModel]).where(
        [EntityModel].tenant_id == tenant_id
    )

    # Apply search (adjust field name per entity)
    if search:
        query = query.where([EntityModel].name.ilike(f"%{search}%"))

    # Apply filters from **kwargs
    for field, value in filters.items():
        if value is not None:
            column = getattr([EntityModel], field, None)
            if column is not None:
                query = query.where(column == value)

    # Count
    count_stmt = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Sorting
    sort_column = getattr([EntityModel], sort_by, [EntityModel].created_at)
    if sort_desc:
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # Pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total
```

**Template for Patch/Update feature:**

```python
"""Repository for [Feature] feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[module].shared.models import [EntityModel]


async def update_[entity](
    db: AsyncSession,
    entity_id: UUID,
    tenant_id: UUID,
    data: dict,
) -> [EntityModel] | None:
    """Update [entity] fields from dict (partial update)."""
    result = await db.execute(
        select([EntityModel]).where(
            [EntityModel].id == entity_id,
            [EntityModel].tenant_id == tenant_id,
        )
    )
    entity = result.scalar_one_or_none()
    if not entity:
        return None
    for key, value in data.items():
        setattr(entity, key, value)
    await db.flush()
    await db.refresh(entity)
    return entity
```

**Template for Delete feature:**

```python
"""Repository for [Feature] feature."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[module].shared.models import [EntityModel]


async def delete_[entity](
    db: AsyncSession,
    entity_id: UUID,
    tenant_id: UUID,
) -> bool:
    """Delete [entity] by ID. Returns True if deleted, False if not found."""
    result = await db.execute(
        select([EntityModel]).where(
            [EntityModel].id == entity_id,
            [EntityModel].tenant_id == tenant_id,
        )
    )
    entity = result.scalar_one_or_none()
    if not entity:
        return False
    await db.delete(entity)
    await db.flush()
    return True
```

### Checkpoint 2

```bash
cd backend && python -c "from app.modules.[module].features.[feature].repository import *; print('OK')"
```

```
⏸ STOP — Step 2: Repository
Done: feature repository created, import check ✅
Next: Step 3 — Domain Layer (Business Logic)
Continue?
```

---

## Step 3: Domain Layer (Business Logic)

### ADR-3: Domain Use Case

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-3: [Module].[Feature] — Domain Use Case
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context:
- Business logic must be separated from HTTP and SQL
- This feature needs to: [validate / compute / transform / call cross-module]
- [If complex: decomposed into additional files: validators.py, helpers.py]
- [If cross-module: calls internal_api/interface.py of target module]

Decision:
- Domain = standalone async function(s)
- Takes db: AsyncSession + input data → returns Response schema
- Validates business rules → raises AppError subclasses on failure
- Calls repository functions for data access
- Maps ORM models → Response schemas
- [Cross-module calls through internal_api/interface.py]
- [Complex logic extracted to helper functions / validators / subfolders]

Consequences:
+ Pure business logic — testable without HTTP or DB
+ Clear error propagation via AppError
+ Easy to add cross-module coordination
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `app/modules/[module]/features/[feature]/domain.py`

**Template for Create feature:**

```python
"""Domain use case for [Feature] feature.

Contains pure business logic — validates input and orchestrates creation.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError, NotFoundError, ConflictError
from app.modules.[module].features.[feature].repository import (
    create_[entity] as create_[entity]_repo,
)
from app.modules.[module].features.[feature].schemas import (
    [FeatureName]Input,
    [FeatureName]Response,
)


async def [feature_function_name](
    db: AsyncSession,
    tenant_id: UUID,
    input_data: [FeatureName]Input,
) -> [FeatureName]Response:
    """Execute the [feature] use case."""
    # 1. Validate business rules
    if not input_data.name or not input_data.name.strip():
        raise ValidationError("[Entity] name is required")

    # 2. [Optional] Cross-module check via internal_api
    # from app.modules.[other_module].internal_api.interface import ...
    # related = await get_something(db, input_data.something_id)
    # if not related:
    #     raise NotFoundError(entity="Related", entity_id=str(input_data.something_id))

    # 3. Call repository
    entity = await create_[entity]_repo(
        db=db,
        tenant_id=tenant_id,
        name=input_data.name.strip(),
        # ... other fields
    )

    # 4. Map to response
    return [FeatureName]Response(
        id=entity.id,
        name=entity.name,
        # ...
    )
```

**Template for Get feature:**

```python
"""Domain use case for [Feature] feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from .repository import (
    get_[entity]_by_id,
)
from .schemas import (
    [Entity]DetailResponse,
)


async def get_[entity]_detail(
    db: AsyncSession,
    tenant_id: UUID,
    entity_id: UUID,
) -> [Entity]DetailResponse:
    """Execute the get [entity] detail use case."""
    entity = await get_[entity]_by_id(db, entity_id, tenant_id)
    if entity is None:
        raise NotFoundError(entity="[Entity]", entity_id=str(entity_id))

    return [Entity]DetailResponse(
        id=entity.id,
        # map all fields...
        created_at=entity.created_at,
        updated_at=entity.updated_at,
    )
```

**Template for List feature:**

```python
"""Domain use case for [Feature] feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[module].features.[feature].repository import (
    list_[entities] as list_[entities]_repo,
)
from app.modules.[module].features.[feature].schemas import (
    [Entity]ListItem,
    [Entity]ListResponse,
)


async def list_[entities](
    db: AsyncSession,
    tenant_id: UUID,
    *,
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    **filters,
) -> [Entity]ListResponse:
    """Execute the list [entities] use case."""
    items, total = await list_[entities]_repo(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        **filters,
    )

    return [Entity]ListResponse(
        items=[[Entity]ListItem(id=item.id, ...) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, -(-total // page_size)),  # ceil division
    )
```

**Template for Patch feature:**

```python
"""Domain use case for [Feature] feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.[module].features.[feature].repository import (
    get_[entity]_by_id,
    update_[entity],
)
from app.modules.[module].features.[feature].schemas import (
    [Entity]PatchInput,
    [Entity]PatchResponse,
)


async def patch_[entity](
    db: AsyncSession,
    tenant_id: UUID,
    entity_id: UUID,
    input_data: [Entity]PatchInput,
) -> [Entity]PatchResponse:
    """Execute the patch [entity] use case."""
    # 1. Build dirty-only update dict (exclude None fields)
    data = input_data.model_dump(exclude_none=True)
    if not data:
        # No changes — return current state
        entity = await get_[entity]_by_id(db, entity_id)
        if entity is None:
            raise NotFoundError(entity="[Entity]", entity_id=str(entity_id))
        return _to_response(entity)

    # 2. [Optional] Handle TranslatedString conversion (JSONB approach)
    # if "name_translations" in data and isinstance(data["name_translations"], dict):
    #     data["name_translations"] = data["name_translations"]

    # 3. Update
    entity = await update_[entity](db, entity_id, tenant_id, data)
    if entity is None:
        raise NotFoundError(entity="[Entity]", entity_id=str(entity_id))

    return _to_response(entity)


def _to_response(entity) -> [Entity]PatchResponse:
    """Map ORM model to response schema."""
    return [Entity]PatchResponse(
        id=entity.id,
        # map all fields...
    )
```

**Template for Delete feature:**

```python
"""Domain use case for [Feature] feature."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.modules.[module].features.[feature].repository import (
    delete_[entity] as delete_[entity]_repo,
)


async def delete_[entity](
    db: AsyncSession,
    tenant_id: UUID,
    entity_id: UUID,
) -> None:
    """Execute the delete [entity] use case."""
    deleted = await delete_[entity]_repo(db, entity_id, tenant_id)
    if not deleted:
        raise NotFoundError(entity="[Entity]", entity_id=str(entity_id))
```

### Checkpoint 3

```bash
cd backend && python -c "from app.modules.[module].features.[feature].domain import *; print('OK')"
```

```
⏸ STOP — Step 3: Domain Layer
Done: feature domain created, import check ✅
Next: Step 4 — Action Layer (FastAPI Route)
Continue?
```

---

## Step 4: Action Layer (FastAPI Route / Presenter)

### ADR-4: Action (Route) Design

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-4: [Module].[Feature] — Action (Route) Design
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Context:
- HTTP endpoint: [METHOD /api/[domain]/[path]]
- Response wrapped in ApiResponse envelope
- Session via get_db() dependency
- Errors raised as AppError → caught and translated to HTTPException

Decision:
- Single APIRouter per feature with prefix
- Router Depends on get_db for session
- Calls domain use case function
- Catches AppError subclasses → raises HTTPException with appropriate status
- Response: ApiResponse(success=True, data=response.model_dump(mode="json"))
- No business logic in action layer — pure orchestration

Consequences:
+ Thin, testable adapter layer
+ Consistent error handling pattern
+ HTTP concerns isolated from business logic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `app/modules/[module]/features/[feature]/action.py`

**Template for Create feature (POST):**

```python
"""Action (Presenter / Route) for [Feature] feature.

FastAPI route handler — thin Adapter layer.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import ValidationError, NotFoundError, ConflictError
from .schemas import (
    [FeatureName]Input,
    [FeatureName]Response,
)
from .domain import (
    [feature_function_name] as [feature_function_alias],
)

router = APIRouter(prefix="/api/[domain]", tags=["[module]"])


@router.post("", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def create_[entity](
    input_data: [FeatureName]Input,
    db: AsyncSession = Depends(get_db),
):
    """Create a new [entity].

    NOTE: tenant_id is hardcoded as a placeholder until auth middleware
    provides the current tenant context.
    """
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    try:
        result = await [feature_function_alias](db, tenant_id, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
            message="[Entity] created successfully",
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
```

**Template for Get feature (GET /{id}):**

```python
"""Action (Presenter / Route) for [Feature] feature."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from .domain import (
    get_[entity]_detail as get_[entity]_detail_usecase,
)

router = APIRouter(prefix="/api/[domain]", tags=["[module]"])


@router.get("/{entity_id}", response_model=ApiResponse)
async def get_[entity]_detail(
    entity_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed info about a [entity] by its ID.

    NOTE: tenant_id is hardcoded as a placeholder until auth middleware
    provides the current tenant context.
    """
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    try:
        result = await get_[entity]_detail_usecase(db, tenant_id, entity_id)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
```

**Template for List feature (GET), Paginated:**

```python
"""Action (Presenter / Route) for [Feature] feature."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from .domain import (
    list_[entities] as list_[entities]_usecase,
)

router = APIRouter(prefix="/api/[domain]", tags=["[module]"])


@router.get("", response_model=ApiResponse)
async def list_[entities](
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: str | None = Query(None),
    # Add domain-specific filters as Query params
    # status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List [entities] with pagination and filters."""
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    result = await list_[entities]_usecase(
        db=db,
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        # status=status,
    )
    return ApiResponse(success=True, data=result.model_dump(mode="json"))
```

**Template for Patch feature (PATCH /{id}):**

```python
"""Action (Presenter / Route) for [Feature] feature."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError, ValidationError
from .schemas import (
    [Entity]PatchInput,
)
from .domain import (
    patch_[entity] as patch_[entity]_usecase,
)

router = APIRouter(prefix="/api/[domain]", tags=["[module]"])


@router.patch("/{entity_id}", response_model=ApiResponse)
async def patch_[entity](
    entity_id: UUID,
    input_data: [Entity]PatchInput,
    db: AsyncSession = Depends(get_db),
):
    """Partially update a [entity] (PATCH — dirty-only fields, merge semantics)."""
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    try:
        result = await patch_[entity]_usecase(db, tenant_id, entity_id, input_data)
        return ApiResponse(
            success=True,
            data=result.model_dump(mode="json"),
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": e.message, "code": e.code},
        )
```

**Template for Delete feature (DELETE /{id}):**

```python
"""Action (Presenter / Route) for [Feature] feature."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.core.exceptions import NotFoundError
from .domain import (
    delete_[entity] as delete_[entity]_usecase,
)

router = APIRouter(prefix="/api/[domain]", tags=["[module]"])


@router.delete("/{entity_id}", response_model=ApiResponse)
async def delete_[entity](
    entity_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a [entity] by ID."""
    import uuid
    tenant_id = uuid.UUID("00000000-0000-0000-0000-000000000001")  # placeholder

    try:
        await delete_[entity]_usecase(db, tenant_id, entity_id)
        return ApiResponse(success=True, message="[Entity] deleted")
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": e.message, "code": e.code},
        )
```

### Register Router in `app/main.py`

```python
# In the route imports section:
from app.modules.[module].features.[feature].action import (
    router as [module]_[feature]_router,
)

# In the include_router section:
app.include_router([module]_[feature]_router)
```

### Checkpoint 4

```bash
cd backend && python -c "from app.modules.[module].features.[feature].action import router; print('OK')"
```

```
⏸ STOP — Step 4: Action Layer
Done: feature action created, registered in main.py ✅
Next: Step 5 — Verification
Continue?
```

---

## Step 5: Verification & Edge Cases

### ADR-5: Edge Cases & Error Handling

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-5: [Module].[Feature] — Edge Cases Verified
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SQL Model Audit (verified in Step 0a):
- [ ] All required fields exist in ORM model
- [ ] JSONB translation columns have correct prefix ({field}_translations)
- [ ] Default values in contract match server_default in model
- [ ] Nullable/required match between contract and model
- [ ] Relationships exist and cascade is correct
- [ ] Indexes on filter/search fields
- [ ] If gaps found → Alembic migration created and applied
- [ ] New models registered in alembic/_alembic_imports.py

Verified edge cases:
- [ ] 404 handling for GET/PATCH/DELETE on non-existent entity
- [ ] Validation errors → 422 with meaningful message
- [ ] Empty PATCH body → return current state (no-op)
- [ ] TranslatedString null handling → empty dict fallback
- [ ] Pagination: page=1 valid, page_size capped at 100
- [ ] Search with empty/whitespace → return all
- [ ] Tenant isolation enforced in all queries

Cross-module calls:
- [ ] All cross-module calls go through internal_api/interface.py
- [ ] Internal API functions exist for each needed operation
- [ ] No direct imports from other modules' features/ or shared/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Run verification

```bash
# 1. Import check — all layers import
cd backend && python -c "
from app.modules.[module].features.[feature].schemas import *
from app.modules.[module].features.[feature].repository import *
from app.modules.[module].features.[feature].domain import *
from app.modules.[module].features.[feature].action import router
print('All layers import OK')
"

# 2. Static type check (if available)
cd backend && python -m pyright app/ 2>/dev/null || echo "pyright not configured — skipping"

# 3. Quick server start (if uvicorn available)
uvicorn app.main:app --reload
# Then test:
# curl http://localhost:8000/api/[domain]
# curl http://localhost:8000/health
```

```
⏸ STOP — Step 5: Verification
Done: imports verified, server test passed ✅
Feature [Module].[Feature] complete.
```

---

## Cross-Module Communication Guide

When feature A needs data from module B:

### 1. Check if interface function exists

```python
# In app/modules/products/features/create_product/domain.py
from app.modules.products.internal_api.interface import get_category_by_id
```

### 2. If NOT — add it to the target module's interface

In [`app/modules/[target_module]/internal_api/interface.py`](backend/app/modules/products/internal_api/interface.py):

```python
"""[Target Module] Internal Service API — public contract for cross-module calls.

Other modules MUST call these functions to get [module] data.
They MUST NOT import from shared/ or features/ directly.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.[target_module].shared.models import [ModelName]
from app.modules.[target_module].features.[feature].repository import (
    some_function as _some_function,
)


async def some_function(
    db: AsyncSession, entity_id: UUID
) -> [ModelName] | None:
    """Get [entity] by ID — cross-module access point."""
    return await _some_function(db, entity_id)
```

### 3. Use it in your feature

```python
from app.modules.[target_module].internal_api.interface import some_function
```

**🚫 NEVER do this:**
```python
# ❌ WRONG — direct cross-module import
from app.modules.[target_module].features.[feature].repository import ...
from app.modules.[target_module].shared.models import ...
```

---

## Complete Feature Checklist

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ [Module].[Feature] — Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pattern:            [Create | Get | List | Patch | Delete | Action | Singleton | Bulk Replace | CSV | Upload]
Endpoint:           [METHOD /api/[domain]/[path]]
SQL Model Audit:    ✅ (N gaps found → fixed via migration)
Model registered:   ✅ (alembic/_alembic_imports.py)
Cross-module deps:  ✅ (via internal_api/interface.py)

Files created:
- app/modules/[module]/features/[feature]/schemas.py
- app/modules/[module]/features/[feature]/repository.py
- app/modules/[module]/features/[feature]/domain.py
- app/modules/[module]/features/[feature]/action.py
- [Optional] validators.py / helpers.py / subfolders

Modified:
- app/main.py (router registered)
- alembic/_alembic_imports.py (if new model added)
- [module]/internal_api/interface.py (if cross-module function added)

Layer tests:
[ ] schemas import check
[ ] repository import check
[ ] domain import check
[ ] action import check
[ ] server starts without errors
[ ] endpoint responds on expected path
```

---

## Quick Reference: ADR Template

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADR-[N]: [Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pattern: [Create | Get | List | Patch | Delete | Action | Singleton | Bulk Replace | CSV | Upload]

Context:
- [Why we need this decision]
- [Constraints or requirements]
- [Existing patterns that influence this]

Decision:
- [What was chosen]
- [How it works]
- [Additional files if complex logic: validators.py, helpers.py]

Alternatives considered:
- [Alternative 1]: [Why rejected]
- [Alternative 2]: [Why rejected]

Consequences:
+ [Positive consequence 1]
+ [Positive consequence 2]
- [Negative consequence or trade-off]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Error Handling Quick Reference

| Situation | Exception | HTTP Status | Code |
|-----------|-----------|-------------|------|
| Entity not found | [`NotFoundError`](backend/app/core/exceptions.py:13) | 404 | `NOT_FOUND` |
| Invalid input | [`ValidationError`](backend/app/core/exceptions.py:24) | 422 | `VALIDATION_ERROR` |
| Authentication required | [`UnauthorizedError`](backend/app/core/exceptions.py:30) | 401 | `UNAUTHORIZED` |
| Permission denied | [`ForbiddenError`](backend/app/core/exceptions.py:37) | 403 | `FORBIDDEN` |
| Duplicate / conflict | [`ConflictError`](backend/app/core/exceptions.py:44) | 409 | `CONFLICT` |

All exceptions extend [`AppError`](backend/app/core/exceptions.py:4) with `message` and `code` properties.

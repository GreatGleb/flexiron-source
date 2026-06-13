"""Model import collector for Alembic.

This module imports ALL ORM models so that Base.metadata is fully populated
for Alembic migration detection. Alembic's env.py imports this file.

NOTE: Existing migrations reference table names (not Python class paths),
so they remain valid after this refactoring.
"""

# Core infrastructure models
from app.core.uploads.models import UploadedFile  # noqa: F401, E402

# Auth module (identity + permissions)
from app.modules.auth.shared.models import (  # noqa: F401, E402
    Tenant, User, Session, UserRole,
    PermissionItem, RolePermission, UserPermission,
)

# Products module (categories + products)
from app.modules.products.shared.models import (  # noqa: F401, E402
    Category, CategoryField, Product, ProductFieldValue,
)

# Warehouse module
from app.modules.warehouse.shared.models import (  # noqa: F401, E402
    WarehouseBatch, WarehouseMovement, WarehouseOffcut,
    WarehouseDeficit, StockItem, StockAuditEntry,
)

# Suppliers module + field config
from app.modules.suppliers.shared.models import (  # noqa: F401, E402
    Supplier, SupplierAddress, SupplierContact, SupplierFile,
    SupplierAuditEntry, SupplierPriceEntry,
    FieldDefinition, SectionConfig, SectionField,
)

# Billing module
from app.modules.billing.shared.models import (  # noqa: F401, E402
    Plan, TenantPlan, PlanFeature, TenantFeatureOverride, FeatureDefinition,
)

# Finance module
from app.modules.finance.shared.models import (  # noqa: F401, E402
    FinancePayment, PaymentDocument, DocumentArchiveItem,
)

# BCC module
from app.modules.bcc.shared.models import (  # noqa: F401, E402
    BccCategory, BccEvent,
)

# Settings module
from app.modules.settings.shared.models import (  # noqa: F401, E402
    CompanyInfo, GlobalConstants, Currency, Uom, UomConversion,
    OrderStatusSetting,
)

# Services module
from app.modules.services.shared.models import Service  # noqa: F401, E402

# Notifications module
from app.modules.notifications.shared.models import Notification  # noqa: F401, E402

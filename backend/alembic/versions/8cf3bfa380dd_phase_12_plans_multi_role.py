"""phase_12_plans_multi_role

Plans, Multi-role (UserRole), Feature flags (PlanFeature, TenantFeatureOverride, FeatureDefinition).

Revision ID: 8cf3bfa380dd
Revises: 7bf1730620f0
Create Date: 2026-06-12 16:32:41.541315

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "8cf3bfa380dd"
down_revision: Union[str, Sequence[str], None] = "7bf1730620f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Helper: all feature flags with translations as JSONB objects ──
FEATURE_FLAGS = [
    # Page-level flags
    ("adminDashboard", '{"ru": "Панель управления", "en": "Dashboard", "lt": "Pagrindinis skydelis"}',
     '{"ru": "Главная панель управления с аналитикой", "en": "Main dashboard with analytics", "lt": "Pagrindinis skydelis su analitika"}',
     "page", False),
    ("adminWarehouse", '{"ru": "Управление складом", "en": "Warehouse Management", "lt": "Sandelio valdymas"}',
     '{"ru": "Полный раздел управления складом", "en": "Full warehouse management section", "lt": "Pilnas sandelio valdymo skyrius"}',
     "page", False),
    ("adminSales", '{"ru": "Продажи", "en": "Sales", "lt": "Pardavimai"}',
     '{"ru": "Раздел продаж и аналитика", "en": "Sales section and analytics", "lt": "Pardavimų skyrius ir analitika"}',
     "page", False),
    ("adminSupply", '{"ru": "Снабжение", "en": "Supply", "lt": "Tiekimas"}',
     '{"ru": "Раздел снабжения", "en": "Supply section", "lt": "Tiekimo skyrius"}',
     "page", False),
    ("adminStaff", '{"ru": "Сотрудники", "en": "Staff", "lt": "Darbuotojai"}',
     '{"ru": "Управление сотрудниками", "en": "Staff management", "lt": "Darbuotojų valdymas"}',
     "page", False),
    ("adminLogistics", '{"ru": "Логистика", "en": "Logistics", "lt": "Logistika"}',
     '{"ru": "Раздел логистики", "en": "Logistics section", "lt": "Logistikos skyrius"}',
     "page", False),
    ("adminPlReport", '{"ru": "P&L Отчёт", "en": "P&L Report", "lt": "P&L Ataskaita"}',
     '{"ru": "Отчёт о прибылях и убытках", "en": "Profit and loss report", "lt": "Pelnų ir nuostolių ataskaita"}',
     "page", False),
    ("adminDeficit", '{"ru": "Дефицит", "en": "Deficit", "lt": "Deficitas"}',
     '{"ru": "Управление дефицитом", "en": "Deficit management", "lt": "Deficito valdymas"}',
     "page", False),
    ("suppliersList", '{"ru": "Список поставщиков", "en": "Suppliers List", "lt": "Tiekėjų sąrašas"}',
     '{"ru": "Список всех поставщиков компании", "en": "List of all company suppliers", "lt": "Visi įmonės tiekėjai"}',
     "page", False),
    ("supplierCard", '{"ru": "Карточка поставщика", "en": "Supplier Card", "lt": "Tiekėjo kortelė"}',
     '{"ru": "Просмотр карточки поставщика", "en": "View supplier card", "lt": "Peržiūrėti tiekėjo kortelę"}',
     "page", False),
    ("supplierCreate", '{"ru": "Создание поставщика", "en": "Create Supplier", "lt": "Sukurti tiekėją"}',
     '{"ru": "Создание нового поставщика", "en": "Create a new supplier", "lt": "Sukurti naują tiekėją"}',
     "page", False),
    ("supplierCardConfig", '{"ru": "Настройка карточки поставщика", "en": "Supplier Card Config", "lt": "Tiekėjo kortelės nustatymai"}',
     '{"ru": "Настройка полей и секций карточки поставщика", "en": "Configure supplier card fields and sections", "lt": "Tiekėjo kortelės laukų ir sekcijų nustatymai"}',
     "page", False),
    ("bccRequest", '{"ru": "BCC Запрос", "en": "BCC Request", "lt": "BCC Užklausa"}',
     '{"ru": "Отправка BCC запросов поставщикам", "en": "Send BCC requests to suppliers", "lt": "Siųsti BCC užklausas tiekėjams"}',
     "page", False),
    ("adminCategories", '{"ru": "Категории", "en": "Categories", "lt": "Kategorijos"}',
     '{"ru": "Управление категориями товаров", "en": "Manage product categories", "lt": "Produktų kategorijų valdymas"}',
     "page", False),
    ("adminProducts", '{"ru": "Товары", "en": "Products", "lt": "Produktai"}',
     '{"ru": "Управление товарами", "en": "Manage products", "lt": "Produktų valdymas"}',
     "page", False),
    ("adminServices", '{"ru": "Услуги", "en": "Services", "lt": "Paslaugos"}',
     '{"ru": "Управление услугами", "en": "Manage services", "lt": "Paslaugų valdymas"}',
     "page", False),
    ("adminClients", '{"ru": "Клиенты", "en": "Clients", "lt": "Klientai"}',
     '{"ru": "Управление клиентами", "en": "Manage clients", "lt": "Klientų valdymas"}',
     "page", False),
    ("adminOrders", '{"ru": "Заказы", "en": "Orders", "lt": "Užsakymai"}',
     '{"ru": "Управление заказами", "en": "Manage orders", "lt": "Užsakymų valdymas"}',
     "page", False),
    ("adminSalesCrm", '{"ru": "CRM Продаж", "en": "Sales CRM", "lt": "Pardavimų CRM"}',
     '{"ru": "CRM система для продаж", "en": "Sales CRM system", "lt": "Pardavimų CRM sistema"}',
     "page", False),
    ("adminSettings", '{"ru": "Настройки", "en": "Settings", "lt": "Nustatymai"}',
     '{"ru": "Настройки системы", "en": "System settings", "lt": "Sistemos nustatymai"}',
     "page", False),

    # Section-level flags
    ("dashboardAlerts", '{"ru": "Оповещения на панели", "en": "Dashboard Alerts", "lt": "Skydelio pranešimai"}',
     '{"ru": "Блок оповещений на панели управления", "en": "Alert section on dashboard", "lt": "Pranešimų sekcija pagrindiniame skydelyje"}',
     "section", False),
    ("dashboardCharts", '{"ru": "Графики на панели", "en": "Dashboard Charts", "lt": "Skydelio diagramos"}',
     '{"ru": "Блок графиков на панели управления", "en": "Chart section on dashboard", "lt": "Diagramų sekcija pagrindiniame skydelyje"}',
     "section", False),
    ("supplierKanbanView", '{"ru": "Kanban просмотр поставщиков", "en": "Supplier Kanban View", "lt": "Tiekėjų Kanban rodinys"}',
     '{"ru": "Kanban-доска для просмотра поставщиков", "en": "Kanban board for supplier view", "lt": "Kanban lenta tiekėjų peržiūrai"}',
     "section", False),
    ("supplierExport", '{"ru": "Экспорт поставщиков", "en": "Supplier Export", "lt": "Tiekėjų eksportas"}',
     '{"ru": "Экспорт данных поставщиков в CSV/Excel", "en": "Export supplier data to CSV/Excel", "lt": "Eksportuoti tiekėjų duomenis į CSV/Excel"}',
     "section", False),
    ("bccHistory", '{"ru": "История BCC", "en": "BCC History", "lt": "BCC Istorija"}',
     '{"ru": "История отправленных BCC запросов", "en": "History of sent BCC requests", "lt": "Išsiųstų BCC užklausų istorija"}',
     "section", False),
    ("permissionsEditor", '{"ru": "Редактор прав доступа", "en": "Permissions Editor", "lt": "Teisių redaktorius"}',
     '{"ru": "Редактор прав ролей и пользователей", "en": "Role and user permission editor", "lt": "Rolių ir vartotojų teisių redaktorius"}',
     "section", False),
    ("categoryFieldReorder", '{"ru": "Перестановка полей категорий", "en": "Category Field Reorder", "lt": "Kategorijos laukų tvarka"}',
     '{"ru": "Изменение порядка полей в категориях", "en": "Reorder fields within categories", "lt": "Pertvarkyti laukus kategorijose"}',
     "section", False),
    ("categorySupplierLinks", '{"ru": "Связи категорий с поставщиками", "en": "Category Supplier Links", "lt": "Kategorijų ir tiekėjų ryšiai"}',
     '{"ru": "Управление связями категорий с поставщиками", "en": "Manage category-supplier links", "lt": "Kategorijų ir tiekėjų ryšių valdymas"}',
     "section", False),
    ("productSupplierLinks", '{"ru": "Связи товаров с поставщиками", "en": "Product Supplier Links", "lt": "Produktų ir tiekėjų ryšiai"}',
     '{"ru": "Управление связями товаров с поставщиками", "en": "Manage product-supplier links", "lt": "Produktų ir tiekėjų ryšių valdymas"}',
     "section", False),

    # Warehouse section-level flags
    ("warehouseOffcuts", '{"ru": "Обрезки склада", "en": "Warehouse Offcuts", "lt": "Sandelio atraižos"}',
     '{"ru": "Управление обрезками на складе", "en": "Manage warehouse offcuts", "lt": "Sandelio atraižų valdymas"}',
     "section", False),
    ("warehouseDeficit", '{"ru": "Дефицит на складе", "en": "Warehouse Deficit", "lt": "Sandelio deficitas"}',
     '{"ru": "Отслеживание дефицита на складе", "en": "Track warehouse deficit", "lt": "Sekti sandelio deficitą"}',
     "section", False),
    ("warehouseQrPrint", '{"ru": "Печать QR склада", "en": "Warehouse QR Print", "lt": "Sandelio QR spausdinimas"}',
     '{"ru": "Печать QR-кодов для склада", "en": "Print QR codes for warehouse", "lt": "Spausdinti QR kodus sandeliui"}',
     "section", False),

    # Warehouse per-tab page config flags
    ("warehouseStockPageConfig", '{"ru": "Настройка страницы остатков", "en": "Stock Page Config", "lt": "Atsargų puslapio nustatymai"}',
     '{"ru": "Настройка отображения страницы остатков", "en": "Configure stock page display", "lt": "Atsargų puslapio rodymo nustatymai"}',
     "section", False),
    ("warehouseBatchesPageConfig", '{"ru": "Настройка страницы партий", "en": "Batches Page Config", "lt": "Partijų puslapio nustatymai"}',
     '{"ru": "Настройка отображения страницы партий", "en": "Configure batches page display", "lt": "Partijų puslapio rodymo nustatymai"}',
     "section", False),
    ("warehouseOffcutsPageConfig", '{"ru": "Настройка страницы обрезков", "en": "Offcuts Page Config", "lt": "Atraižų puslapio nustatymai"}',
     '{"ru": "Настройка отображения страницы обрезков", "en": "Configure offcuts page display", "lt": "Atraižų puslapio rodymo nustatymai"}',
     "section", False),
    ("warehouseMovementsPageConfig", '{"ru": "Настройка страницы перемещений", "en": "Movements Page Config", "lt": "Judėjimų puslapio nustatymai"}',
     '{"ru": "Настройка отображения страницы перемещений", "en": "Configure movements page display", "lt": "Judėjimų puslapio rodymo nustatymai"}',
     "section", False),
    ("warehouseDeficitPageConfig", '{"ru": "Настройка страницы дефицита", "en": "Deficit Page Config", "lt": "Deficito puslapio nustatymai"}',
     '{"ru": "Настройка отображения страницы дефицита", "en": "Configure deficit page display", "lt": "Deficito puslapio rodymo nustatymai"}',
     "section", False),

    # Orders section-level flags
    ("orderKanbanView", '{"ru": "Kanban просмотр заказов", "en": "Order Kanban View", "lt": "Užsakymų Kanban rodinys"}',
     '{"ru": "Kanban-доска для просмотра заказов", "en": "Kanban board for order view", "lt": "Kanban lenta užsakymų peržiūrai"}',
     "section", False),
    ("orderDocumentGen", '{"ru": "Генерация документов заказа", "en": "Order Document Gen", "lt": "Užsakymo dokumentų generavimas"}',
     '{"ru": "Генерация документов для заказов", "en": "Generate documents for orders", "lt": "Generuoti dokumentus užsakymams"}',
     "section", False),
    ("orderCuttingTool", '{"ru": "Инструмент раскроя", "en": "Order Cutting Tool", "lt": "Pjovimo įrankis"}',
     '{"ru": "Инструмент для расчёта раскроя материалов", "en": "Material cutting calculation tool", "lt": "Medžiagų pjovimo skaičiavimo įrankis"}',
     "section", False),

    # Other
    ("warehouseOffcutCreate", '{"ru": "Создание обрезка", "en": "Create Offcut", "lt": "Sukurti atraižą"}',
     '{"ru": "Создание новой записи обрезка на складе", "en": "Create a new offcut record in warehouse", "lt": "Sukurti naują atraižos įrašą sandelyje"}',
     "section", False),
    ("notificationsPage", '{"ru": "Страница уведомлений", "en": "Notifications Page", "lt": "Pranešimų puslapis"}',
     '{"ru": "Страница просмотра уведомлений", "en": "Notifications viewing page", "lt": "Pranešimų peržiūros puslapis"}',
     "page", False),

    # Finance page-level flags
    ("adminFinance", '{"ru": "Финансы", "en": "Finance", "lt": "Finansai"}',
     '{"ru": "Раздел финансов", "en": "Finance section", "lt": "Finansų skyrius"}',
     "page", False),
    ("financeIncoming", '{"ru": "Входящие платежи", "en": "Incoming Payments", "lt": "Gaunami mokėjimai"}',
     '{"ru": "Входящие платежи и поступления", "en": "Incoming payments and receipts", "lt": "Gaunami mokėjimai ir įplaukos"}',
     "page", False),
    ("financeOutgoing", '{"ru": "Исходящие платежи", "en": "Outgoing Payments", "lt": "Išsiunčiami mokėjimai"}',
     '{"ru": "Исходящие платежи и расходы", "en": "Outgoing payments and expenses", "lt": "Išsiunčiami mokėjimai ir išlaidos"}',
     "page", False),
    ("financeDocumentArchive", '{"ru": "Архив документов", "en": "Document Archive", "lt": "Dokumentų archyvas"}',
     '{"ru": "Архив финансовых документов", "en": "Financial document archive", "lt": "Finansinių dokumentų archyvas"}',
     "page", False),
]


def upgrade() -> None:
    """Create plans, user_role, feature flags tables + seed feature_definitions."""

    # ── 1. plans ───────────────────────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── 2. tenant_plans (M2M: tenant → plan) ───────────────────────────
    op.create_table(
        "tenant_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "plan_id", name="uq_tenant_plan"),
    )

    # ── 3. plan_features (feature flag within a plan) ──────────────────
    op.create_table(
        "plan_features",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("feature_key", sa.String(100), nullable=False),
        sa.Column("is_allowed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_denied", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("plan_id", "feature_key", name="uq_plan_feature"),
    )

    # ── 4. tenant_feature_overrides (tenant overrides plan) ─────────────
    op.create_table(
        "tenant_feature_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("feature_key", sa.String(100), nullable=False),
        sa.Column("is_allowed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_denied", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_id", "feature_key", name="uq_tenant_feature_override"),
    )

    # ── 5. feature_definitions (registry of all known flags) ────────────
    op.create_table(
        "feature_definitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("key", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("name_translations", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("description_translations", postgresql.JSONB(), nullable=True, server_default="{}"),
        sa.Column("level", sa.String(20), nullable=False, server_default="page"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # ── 6. user_roles (M2M: user → role) ────────────────────────────────
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("role_name", sa.String(50), nullable=False),
        sa.UniqueConstraint("user_id", "role_name", name="uq_user_role"),
    )

    # ── 7. Data migration: seed feature_definitions ─────────────────────
    op.bulk_insert(
        sa.table(
            "feature_definitions",
            sa.Column("key", sa.String(100)),
            sa.Column("name_translations", postgresql.JSONB()),
            sa.Column("description_translations", postgresql.JSONB()),
            sa.Column("level", sa.String(20)),
            sa.Column("is_system", sa.Boolean()),
        ),
        [
            {
                "key": key,
                "name_translations": name_json,
                "description_translations": desc_json,
                "level": level,
                "is_system": is_system,
            }
            for key, name_json, desc_json, level, is_system in FEATURE_FLAGS
        ],
    )


def downgrade() -> None:
    """Drop all tables created in this revision."""
    op.drop_table("user_roles")
    op.drop_table("feature_definitions")
    op.drop_table("tenant_feature_overrides")
    op.drop_table("plan_features")
    op.drop_table("tenant_plans")
    op.drop_table("plans")

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base import Base, TimestampMixin, UUIDMixin


class Plan(UUIDMixin, TimestampMixin, Base):
    """Pricing plan / tariff — defines a set of features for a tenant."""

    __tablename__ = "plans"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # Relationships
    tenant_links: Mapped[list["TenantPlan"]] = relationship(
        "TenantPlan", back_populates="plan", cascade="all, delete-orphan"
    )
    features: Mapped[list["PlanFeature"]] = relationship(
        "PlanFeature", back_populates="plan", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Plan {self.slug}>"


class TenantPlan(UUIDMixin, Base):
    """Junction: company → plan (M2M). A tenant can have multiple active plans."""

    __tablename__ = "tenant_plans"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    plan: Mapped["Plan"] = relationship("Plan", back_populates="tenant_links")

    __table_args__ = (
        UniqueConstraint("tenant_id", "plan_id", name="uq_tenant_plan"),
    )

    def __repr__(self) -> str:
        return f"<TenantPlan tenant={self.tenant_id} plan={self.plan_id}>"


class PlanFeature(UUIDMixin, Base):
    """Feature flag within a plan — defines whether a feature is allowed or denied."""

    __tablename__ = "plan_features"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False)
    is_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_denied: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    plan: Mapped["Plan"] = relationship("Plan", back_populates="features")

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_key", name="uq_plan_feature"),
    )

    def __repr__(self) -> str:
        return f"<PlanFeature plan={self.plan_id} key={self.feature_key}>"


class TenantFeatureOverride(UUIDMixin, TimestampMixin, Base):
    """Tenant-level override of a plan feature flag."""

    __tablename__ = "tenant_feature_overrides"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_key: Mapped[str] = mapped_column(String(100), nullable=False)
    is_allowed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_denied: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "feature_key", name="uq_tenant_feature_override"
        ),
    )

    def __repr__(self) -> str:
        return f"<TenantFeatureOverride tenant={self.tenant_id} key={self.feature_key}>"


class FeatureDefinition(UUIDMixin, TimestampMixin, Base):
    """Registry of all known feature flag keys — single source of truth."""

    __tablename__ = "feature_definitions"

    key: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    name_translations: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    description_translations: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=dict, server_default="{}")
    level: Mapped[str] = mapped_column(
        String(20), nullable=False, default="page", server_default="page"
    )
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    def __repr__(self) -> str:
        return f"<FeatureDefinition {self.key}>"

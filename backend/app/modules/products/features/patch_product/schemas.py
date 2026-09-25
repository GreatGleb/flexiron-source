"""Schemas for Patch Product feature (Responder / Boundary layer).

The wire uses camelCase (what the client sends); the model stores the same
fields in snake_case. Aliases bridge the two — the sibling `create_product`
and `get_product_detail` schemas don't do this, which is exactly why their
camelCase bodies are silently dropped as `extra` (see `products.md`).
"""

from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID


class PatchProductFieldValueInput(BaseModel):
    """One entry of a full-array `fieldValues` replace.

    Only `fieldId` and `value` are stored — a materialized copy of the field
    definition (`fieldName`, `fieldType`, `options`, `inherited`) may ride
    along on the wire and is ignored (default `extra="ignore"`).
    """

    model_config = ConfigDict(populate_by_name=True)

    field_id: UUID = Field(alias="fieldId")
    value: str | None = None


class PatchProductInput(BaseModel):
    """Merge-patch body — only keys actually present in the request apply.

    Use `model_fields_set` (not `exclude_none`) to tell "key absent" from
    "key sent as null": a nullable column is cleared only by the latter.
    """

    model_config = ConfigDict(populate_by_name=True)

    name: str | None = None
    sku: str | None = None
    description: str | None = None
    price: float | None = None
    min_stock: float | None = Field(default=None, alias="minStock")
    price_quantity: int | None = Field(default=None, alias="priceQuantity", ge=1)
    currency_id: UUID | None = Field(default=None, alias="currencyId")
    purchase_uom_id: UUID | None = Field(default=None, alias="purchaseUomId")
    warehouse_uom_id: UUID | None = Field(default=None, alias="warehouseUomId")
    sale_uom_id: UUID | None = Field(default=None, alias="saleUomId")
    purchase_to_warehouse_formula_type: str | None = Field(
        default=None, alias="purchaseToWarehouseFormulaType"
    )
    purchase_to_warehouse_factor: float | None = Field(
        default=None, alias="purchaseToWarehouseFactor"
    )
    warehouse_to_sale_formula_type: str | None = Field(
        default=None, alias="warehouseToSaleFormulaType"
    )
    warehouse_to_sale_factor: float | None = Field(
        default=None, alias="warehouseToSaleFactor"
    )
    field_values: list[PatchProductFieldValueInput] | None = Field(
        default=None, alias="fieldValues"
    )

"""Orders Internal Service API — the public contract for cross-module calls.

The `clients` module asks here whether a client still has orders before it
deletes one, the same way it asks the `audit` module to drop that client's
journal rows. It MUST NOT import `app.modules.orders.shared.models` directly
— a cross-module import of another module's storage is exactly what
`tests/test_module_boundaries.py` catches.
"""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.orders.shared.models import Order


async def count_orders_for_client(
    db: AsyncSession, *, tenant_id: UUID, client_id: UUID
) -> int:
    """How many orders name this client inside this tenant.

    Both filters are mandatory and neither has a default: an order belongs
    to one tenant and names one client, and a count missing either would
    answer for rows the caller may not see. `tenant_id` stays in the body of
    this function on purpose — `tests/test_tenant_scope.py` (Т2) refuses a
    count that delegates its narrowing to a neighbor.
    """
    statement = (
        select(func.count())
        .select_from(Order)
        .where(Order.tenant_id == tenant_id, Order.client_id == client_id)
    )
    result = await db.execute(statement)
    return result.scalar() or 0

"""Public surface of the orders module's internal API.

Everything another module is allowed to call lives behind this package:

    from app.modules.orders.internal_api import count_orders_for_client

The re-export is what keeps callers off `...internal_api.interface`
internals and gives the import one visible entry point.
"""

from app.modules.orders.internal_api.interface import count_orders_for_client

__all__ = ["count_orders_for_client"]

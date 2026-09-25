"""Idempotency module — server-side store for `Idempotency-Key` requests.

No routes: other modules reach this store only through
`app.modules.idempotency.internal_api.interface`.
"""

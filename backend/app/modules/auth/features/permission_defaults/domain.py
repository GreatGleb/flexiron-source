"""Domain use case for permission_defaults — П33.

A new matrix item is not born rightless: the moment it appears, this
use case computes its default permissions from the tenant's existing rows
in the *same domain* and writes them as ordinary `role_permissions` /
`user_permissions` rows. There is no computed state — those rows are then
free to be edited by hand like any other, and the next new item's
computation does not touch them.

Two layers, both from `00-conventions.md` §6.4:

* base layer — role `admin` gets all four actions on the new item,
  unconditionally;
* 90% rule — a role, or a user's personal override, that already has a
  given action on at least 90% of the domain's existing items gets that
  same action on the new one. Actions are granted one at a time: a holder
  at 95% read and 50% edit gets read and not edit on the new item. The
  rule runs the same way for roles and for user overrides — two
  independent inputs, one formula.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .repository import (
    insert_permission_item,
    insert_role_permission,
    insert_user_permission,
    list_domain_item_ids,
    list_role_permissions_for_items,
    list_user_permissions_for_items,
)

ACTIONS = ("can_read", "can_edit", "can_create", "can_delete")

# 90% as an exact fraction — `count / total >= 0.9` compared through
# `count * THRESHOLD_DEN >= total * THRESHOLD_NUM` so no float rounding
# can nudge a borderline row across the line.
THRESHOLD_NUM = 9
THRESHOLD_DEN = 10


def _coverage(rows: list[Any], key_attr: str, total: int) -> dict[Any, dict[str, bool]]:
    """For each distinct `key_attr` value in `rows`, which actions already
    reach the 90% threshold across `total` domain items."""
    if total == 0:
        return {}
    counts: dict[Any, dict[str, int]] = {}
    for row in rows:
        bucket = counts.setdefault(
            getattr(row, key_attr), {action: 0 for action in ACTIONS}
        )
        for action in ACTIONS:
            if getattr(row, action):
                bucket[action] += 1
    return {
        key: {
            action: count * THRESHOLD_DEN >= total * THRESHOLD_NUM
            for action, count in bucket.items()
        }
        for key, bucket in counts.items()
    }


async def create_permission_item_with_defaults(
    db: AsyncSession,
    tenant_id: UUID,
    *,
    item_id: str,
    domain: str,
    item_type: str,
    parent_id: str | None = None,
    name_translations: dict | None = None,
):
    """Add a matrix item and compute+persist its default permissions (П33)."""
    existing_item_ids = await list_domain_item_ids(db, tenant_id=tenant_id, domain=domain)
    total = len(existing_item_ids)

    role_rows = await list_role_permissions_for_items(
        db, tenant_id=tenant_id, item_ids=existing_item_ids
    )
    user_rows = await list_user_permissions_for_items(
        db, tenant_id=tenant_id, item_ids=existing_item_ids
    )

    role_actions = _coverage(role_rows, "role", total)
    role_actions["admin"] = {action: True for action in ACTIONS}
    user_actions = _coverage(user_rows, "user_id", total)

    item = await insert_permission_item(
        db,
        tenant_id=tenant_id,
        item_id=item_id,
        domain=domain,
        item_type=item_type,
        parent_id=parent_id,
        name_translations=name_translations or {},
    )

    for role, actions in role_actions.items():
        granted = {action: actions.get(action, False) for action in ACTIONS}
        if any(granted.values()):
            await insert_role_permission(
                db, tenant_id=tenant_id, item_id=item.item_id, role=role, **granted
            )

    for user_id, actions in user_actions.items():
        granted = {action: actions.get(action, False) for action in ACTIONS}
        if any(granted.values()):
            await insert_user_permission(
                db,
                tenant_id=tenant_id,
                item_id=item.item_id,
                user_id=user_id,
                **granted,
            )

    return item

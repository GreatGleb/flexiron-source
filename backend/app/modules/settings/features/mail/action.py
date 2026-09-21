"""Action (Routes) for the settings mail slice.

  - GET   /api/settings/mail       → the tenant's mail server as the form reads it
  - PATCH /api/settings/mail       → merge-patch of the same fields
  - POST  /api/settings/mail/test  → send the test letter, save nothing

One server per tenant, so no id appears in any path.  Authenticates with the
Bearer session token, same as the rest of the domain.

No business logic here: the rules live in `domain.py`, and the two pieces that
are not this slice's own — the token/tenant rules and the SMTP client — come from
`settings/shared/dependencies.py` and `bcc`'s internal API.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.schemas import ApiResponse
from app.modules.bcc.internal_api.interface import MailNotConfiguredError
from app.modules.settings.features.mail.domain import (
    get_mail_settings as get_mail_settings_usecase,
    patch_mail_settings as patch_mail_settings_usecase,
    send_mail_test as send_mail_test_usecase,
)
from app.modules.settings.features.mail.schemas import MailSettingsPatchInput
from app.modules.auth.internal_api.interface import CurrentUser, get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/mail", response_model=ApiResponse)
async def get_mail_settings(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Read the tenant's mail server.

    Never refuses: an unconfigured server is empty fields, not a missing
    resource, and the form has to open either way.
    """
    tenant_id = current_user.tenant_id
    result = await get_mail_settings_usecase(db, tenant_id)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.patch("/mail", response_model=ApiResponse)
async def patch_mail_settings(
    input_data: MailSettingsPatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update the mail server (merge-patch). Creates the row on first save.

    An absent or empty `password` keeps the stored one; the response never
    carries it back.
    """
    tenant_id = current_user.tenant_id
    result = await patch_mail_settings_usecase(db, tenant_id, input_data)
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )


@router.post("/mail/test", response_model=ApiResponse)
async def send_mail_test(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Send the test letter to the saved sender address, saving nothing.

    The refusal is `409 MAIL_NOT_CONFIGURED` — the code the frontend gate and the
    BCC tool already read; the letter goes to the sender itself, and the answer
    names that address so the person knows where to look for it.
    """
    tenant_id = current_user.tenant_id
    try:
        result = await send_mail_test_usecase(db, tenant_id)
    except MailNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": e.message, "code": e.code},
        )
    return ApiResponse(
        success=True,
        data=result.model_dump(mode="json", by_alias=True),
    )

"""Schemas for the settings mail slice.

camelCase aliases match `MailServerSettings` and `MailServerPayload` in
`frontend_vue/src/types/settings.ts`, the same way the rest of the domain does.

`password` exists in the patch input and **not** in the response: by П59 it is
written and never read back, so `passwordSet` is the only thing a client learns
about it.
"""

from pydantic import BaseModel, Field


class MailSettingsResponse(BaseModel):
    """Mail server settings as the `Почта` tab reads them."""

    host: str = ""
    port: int = 587
    encryption: str = "starttls"
    username: str = ""
    password_set: bool = Field(alias="passwordSet", default=False)
    from_email: str = Field(alias="fromEmail", default="")
    from_name: str = Field(alias="fromName", default="")

    model_config = {"populate_by_name": True}


class MailSettingsPatchInput(BaseModel):
    """Body for PATCH — merge semantics, dirty-only fields.

    An absent `password` means "do not touch it", and so does an empty one: the
    empty field of the form says the human did not type a new password, not that
    the stored one should be erased.  Erasing is not offered at all — there is no
    action for it in the interface, and this endpoint does not invent one.
    """

    host: str | None = None
    port: int | None = None
    encryption: str | None = None
    username: str | None = None
    password: str | None = None
    from_email: str | None = Field(alias="fromEmail", default=None)
    from_name: str | None = Field(alias="fromName", default=None)

    model_config = {"populate_by_name": True}


class MailTestResponse(BaseModel):
    """Answer of the test letter — the address it actually went to."""

    delivered_to: str = Field(alias="deliveredTo")

    model_config = {"populate_by_name": True}

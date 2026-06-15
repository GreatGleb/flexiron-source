"""Schemas for Magic Link Login feature."""

from pydantic import BaseModel


class MagicLinkInput(BaseModel):
    """Input for magic link login — just the token from the URL."""

    token: str


class MagicLinkVerifyResponse(BaseModel):
    """Response after verifying a magic link token.

    Returns the user's email so the frontend can redirect to
    the login page with the email pre-filled.
    """

    email: str

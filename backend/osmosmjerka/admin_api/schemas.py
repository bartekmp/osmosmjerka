"""Pydantic models for admin API request/response validation."""

from pydantic import BaseModel, Field


class EnabledToggle(BaseModel):
    """Request model for enabling/disabling a feature."""

    enabled: bool = Field(..., description="Whether the feature should be enabled")


class ListLimitsUpdate(BaseModel):
    """Request model for updating private list limits."""

    user_limit: int | None = Field(None, ge=1, description="Maximum lists for regular users")
    admin_limit: int | None = Field(None, ge=1, description="Maximum lists for admins")


class EmailTemplateUpdate(BaseModel):
    """Request model for saving or previewing a transactional email template."""

    subject: str = Field(..., max_length=200, description="Subject line, may contain placeholders")
    body: str = Field(..., max_length=20000, description="Markdown body, may contain placeholders")


class EmailTestSend(BaseModel):
    """Request model for sending a test email."""

    email: str = Field(..., max_length=320, description="Where to send the test")

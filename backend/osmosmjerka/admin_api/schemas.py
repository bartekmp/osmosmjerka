"""Pydantic models for admin API request/response validation."""

from typing import Optional

from pydantic import BaseModel, Field


class EnabledToggle(BaseModel):
    """Request model for enabling/disabling a feature."""

    enabled: bool = Field(..., description="Whether the feature should be enabled")


class ListLimitsUpdate(BaseModel):
    """Request model for updating private list limits."""

    user_limit: Optional[int] = Field(None, ge=1, description="Maximum lists for regular users")
    admin_limit: Optional[int] = Field(None, ge=1, description="Maximum lists for admins")

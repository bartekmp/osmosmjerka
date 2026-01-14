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


class TimeBonusSettings(BaseModel):
    """Nested model for time bonus configuration."""

    max_ratio: float = Field(..., ge=0, description="Maximum time bonus ratio")
    target_times_seconds: dict[str, int] = Field(..., description="Target times in seconds by difficulty level")


class ScoringRulesUpdate(BaseModel):
    """Request model for updating scoring rules configuration."""

    base_points_per_phrase: int = Field(..., ge=0, description="Base points earned per phrase")
    difficulty_multipliers: dict[str, float] = Field(..., description="Score multipliers by difficulty level")
    completion_bonus_points: int = Field(..., ge=0, description="Bonus points for completing a puzzle")
    hint_penalty_per_hint: int = Field(..., ge=0, description="Points deducted per hint used")
    time_bonus: Optional[TimeBonusSettings] = Field(None, description="Time bonus settings (nested)")
    # Flat alternatives for backwards compatibility
    max_time_bonus_ratio: Optional[float] = Field(None, ge=0, description="Max time bonus ratio (flat)")
    target_times_seconds: Optional[dict[str, int]] = Field(None, description="Target times in seconds (flat)")

    def get_time_bonus_settings(self) -> tuple[float, dict[str, int]]:
        """Extract time bonus settings from either nested or flat format."""
        if self.time_bonus:
            return self.time_bonus.max_ratio, self.time_bonus.target_times_seconds
        if self.max_time_bonus_ratio is not None and self.target_times_seconds is not None:
            return self.max_time_bonus_ratio, self.target_times_seconds
        raise ValueError("Missing time bonus settings (either nested or flat)")

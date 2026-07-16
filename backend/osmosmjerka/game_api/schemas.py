"""Pydantic models for game API request/response validation."""

from typing import Any, Optional

from pydantic import BaseModel, Field

# ===== Learn Later / Private Lists =====


class LearnLaterCheckRequest(BaseModel):
    """Request model for checking phrases in Learn This Later list."""

    language_set_id: Optional[int] = None
    phrase_ids: list[int] = Field(default_factory=list)


class LearnLaterBulkAddRequest(BaseModel):
    """Request model for bulk adding phrases to Learn This Later list."""

    language_set_id: int
    phrase_ids: list[int] = Field(..., min_length=1)


class PhraseImportItem(BaseModel):
    """Single phrase for batch import."""

    phrase: str = Field(..., max_length=200)
    translation: str = Field(..., max_length=200)
    categories: str = Field(default="", max_length=200)


class CreatePrivateListRequest(BaseModel):
    """Request model for creating a private list.

    Fields are lenient so the endpoint can return its existing business-logic
    error responses (empty name, missing language set) instead of a 422.
    """

    list_name: str = Field(default="", max_length=200)
    language_set_id: Optional[int] = None


class UpdatePrivateListRequest(BaseModel):
    """Request model for renaming a private list."""

    list_name: str = Field(default="", max_length=200)


class AddPhraseToPrivateListRequest(BaseModel):
    """Request model for adding a phrase to a private list.

    Accepts either an existing ``phrase_id`` or custom phrase fields; the
    endpoint enforces the mutual-exclusivity rules and returns its own errors.
    """

    phrase_id: Optional[int] = None
    custom_phrase: str = Field(default="", max_length=200)
    custom_translation: str = Field(default="", max_length=200)
    custom_categories: str = Field(default="", max_length=200)


# ===== Export =====


class ExportPuzzleRequest(BaseModel):
    """Request model for exporting a puzzle."""

    category: str
    grid: list[Any]  # 2D grid of characters
    phrases: list[Any]  # Can be strings or dicts with phrase/translation
    format: str = Field(default="docx", pattern="^(docx|png)$")


# ===== Game Sessions =====


class StartGameSessionRequest(BaseModel):
    """Request model for starting a game session."""

    language_set_id: int
    category: str
    difficulty: str
    grid_size: int = Field(..., ge=1)
    total_phrases: int = Field(..., ge=1)
    game_type: str = Field(default="word_search", pattern="^(word_search|crossword)$")
    # For teacher puzzle sessions
    phrase_set_id: Optional[int] = None
    hotlink_token: Optional[str] = None


class UpdateGameProgressRequest(BaseModel):
    """Request model for updating game progress."""

    session_id: int
    phrases_found: int = Field(..., ge=0)
    duration_seconds: int = Field(..., ge=0)


class CompleteGameSessionRequest(BaseModel):
    """Request model for completing a game session."""

    session_id: int
    phrases_found: int = Field(..., ge=0)
    duration_seconds: int = Field(..., ge=0)
    completed: bool = True


# ===== User Preferences =====


class IgnoredCategoriesUpdate(BaseModel):
    """Request model for updating user's ignored categories."""

    language_set_id: int
    categories: list[str] = Field(default_factory=list)


class UserPreferenceUpdate(BaseModel):
    """Request model for setting a user preference."""

    preference_key: str
    preference_value: str

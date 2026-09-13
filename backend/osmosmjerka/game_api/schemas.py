"""Pydantic models for game API request/response validation."""

from typing import Any

from pydantic import BaseModel, Field, field_validator

# ===== Learn Later / Private Lists =====


class LearnLaterCheckRequest(BaseModel):
    """Request model for checking phrases in Learn This Later list."""

    language_set_id: int | None = None
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
    language_set_id: int | None = None


class UpdatePrivateListRequest(BaseModel):
    """Request model for renaming a private list."""

    list_name: str = Field(default="", max_length=200)


class AddPhraseToPrivateListRequest(BaseModel):
    """Request model for adding a phrase to a private list.

    Accepts either an existing ``phrase_id`` or custom phrase fields; the
    endpoint enforces the mutual-exclusivity rules and returns its own errors.
    """

    phrase_id: int | None = None
    custom_phrase: str = Field(default="", max_length=200)
    custom_translation: str = Field(default="", max_length=200)
    custom_categories: str = Field(default="", max_length=200)


# ===== Export =====

# /api/export is unauthenticated and renders whatever grid it is handed, so the request
# body has to be bounded here - the 2 MB request cap is nowhere near tight enough. A
# 400x400 grid is only 0.76 MB of JSON but OOM-kills a 512Mi pod rendering the PNG, and
# the DOCX path costs superlinear CPU. The largest grid the app itself produces is 20x20
# (very_hard, which is also the teacher slider's maximum), so 50 is headroom, not a limit
# anyone will meet in normal use.
MAX_EXPORT_GRID_DIMENSION = 50
MAX_EXPORT_PHRASES = 200
MAX_EXPORT_CATEGORY_LENGTH = 200


class ExportPuzzleRequest(BaseModel):
    """Request model for exporting a puzzle."""

    category: str = Field(..., max_length=MAX_EXPORT_CATEGORY_LENGTH)
    # 2D grid of characters (crossword cells may be null)
    grid: list[Any] = Field(..., max_length=MAX_EXPORT_GRID_DIMENSION)
    # Can be strings or dicts with phrase/translation
    phrases: list[Any] = Field(..., max_length=MAX_EXPORT_PHRASES)
    format: str = Field(default="docx", pattern="^(docx|png)$")
    game_type: str = Field(default="word_search", pattern="^(word_search|crossword)$")
    across_label: str = Field(default="Across", max_length=50)
    down_label: str = Field(default="Down", max_length=50)

    @field_validator("grid")
    @classmethod
    def _rows_must_be_bounded(cls, grid: list[Any]) -> list[Any]:
        """max_length on the field only bounds the row count; a 2x100000 grid costs the
        same to render as a tall one, so each row has to be checked too."""
        for row in grid:
            if isinstance(row, (list, tuple)) and len(row) > MAX_EXPORT_GRID_DIMENSION:
                raise ValueError(f"grid rows must have at most {MAX_EXPORT_GRID_DIMENSION} cells")
        return grid


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
    phrase_set_id: int | None = None
    hotlink_token: str | None = None


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

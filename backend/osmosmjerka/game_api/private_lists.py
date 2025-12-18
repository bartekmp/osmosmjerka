"""Private list management endpoints for game API."""

import csv
import io
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse

from osmosmjerka.auth import get_current_user
from osmosmjerka.cache import rate_limit
from osmosmjerka.database import db_manager
from osmosmjerka.game_api.helpers import _generate_grid_with_exact_phrase_count, get_grid_size_and_num_phrases
from osmosmjerka.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter()


# User Private Lists - Learn This Later endpoints
@router.post("/user/learn-later/check")
@rate_limit(max_requests=30, window_seconds=60)
async def check_phrases_in_learn_later(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Check which phrases are already in user's Learn This Later list"""
    try:
        language_set_id = body.get("language_set_id")
        phrase_ids = body.get("phrase_ids", [])

        if not language_set_id or not phrase_ids:
            return JSONResponse({"in_list": []})

        # Get "Learn This Later" list (don't create if doesn't exist)
        learn_later_list = await db_manager.get_learn_later_list(user["id"], language_set_id, create_if_missing=False)

        if not learn_later_list:
            return JSONResponse({"in_list": []})

        # Check which phrases are already in the list
        existing_phrases = await db_manager.get_phrase_ids_in_private_list(learn_later_list["id"], phrase_ids)

        return JSONResponse({"in_list": existing_phrases, "total_in_list": len(existing_phrases)})

    except Exception:
        logger.exception("Failed to check phrases in Learn This Later")
        return JSONResponse({"in_list": []}, status_code=200)  # Fail gracefully


@router.post("/user/learn-later/bulk")
@rate_limit(max_requests=20, window_seconds=60)
async def bulk_add_to_learn_later(body: dict = Body(...), user=Depends(get_current_user)) -> JSONResponse:
    """Add multiple phrases to user's Learn This Later list"""
    try:
        language_set_id = body.get("language_set_id")
        phrase_ids = body.get("phrase_ids", [])

        if not language_set_id or not phrase_ids:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Get or create "Learn This Later" list
        learn_later_list = await db_manager.get_or_create_learn_later_list(user["id"], language_set_id)

        # Add phrases (automatically skips duplicates)
        added_count = await db_manager.bulk_add_phrases_to_private_list(
            learn_later_list["id"], phrase_ids, language_set_id, skip_duplicates=True
        )

        return JSONResponse(
            {
                "message": "Phrases added successfully",
                "added_count": added_count,
                "skipped": len(phrase_ids) - added_count,
                "list_id": learn_later_list["id"],
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add phrases to Learn This Later")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists")
@rate_limit(max_requests=30, window_seconds=60)
async def get_user_private_lists(
    language_set_id: int = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Get paginated private lists for the current user, optionally filtered by language set"""
    try:
        result = await db_manager.get_user_private_lists(user["id"], language_set_id, limit=limit, offset=offset)

        # Batch fetch phrase counts (fixes N+1 query problem)
        list_ids = [list_info["id"] for list_info in result["lists"]]
        phrase_counts = await db_manager.get_phrase_counts_batch(list_ids)

        # Enrich lists with phrase counts
        enriched_lists = []
        for list_info in result["lists"]:
            enriched_lists.append({**list_info, "phrase_count": phrase_counts.get(list_info["id"], 0)})

        return JSONResponse(
            jsonable_encoder(
                {
                    "lists": enriched_lists,
                    "total": result["total"],
                    "limit": result["limit"],
                    "offset": result["offset"],
                    "has_more": result["has_more"],
                }
            )
        )
    except Exception as e:
        logger.exception("Failed to get user private lists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists/{list_id}/phrases")
@rate_limit(max_requests=20, window_seconds=60)
async def get_private_list_phrases_endpoint(
    list_id: int,
    language_set_id: int = Query(...),
    category: str = Query(None),
    difficulty: str = Query("medium"),
    refresh: bool = Query(False),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Get phrases from a private list for puzzle generation, with optional category filter"""
    try:
        # Treat "ALL" as None to get phrases from all categories
        category_filter = None if category == "ALL" else category
        # Get phrases from the private list
        all_phrases = await db_manager.get_private_list_phrases(
            list_id, user["id"], language_set_id, category=category_filter
        )

        if not all_phrases:
            return JSONResponse({"error_code": "NO_PHRASES_IN_LIST"}, status_code=status.HTTP_404_NOT_FOUND)

        # Use the same grid generation logic as regular puzzles
        grid_size, num_phrases = get_grid_size_and_num_phrases(all_phrases, difficulty)

        if len(all_phrases) < num_phrases:
            return JSONResponse(
                {
                    "error_code": "NOT_ENOUGH_PHRASES",
                    "available": len(all_phrases),
                    "required": num_phrases,
                    "grid_size": grid_size,
                },
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Generate grid with exact phrase count
        grid, selected_phrases = _generate_grid_with_exact_phrase_count(all_phrases, grid_size, num_phrases)

        response_data = {
            "grid": grid,
            "phrases": selected_phrases,
            "grid_size": grid_size,
            "difficulty": difficulty,
            "category": category or "Mixed",
            "source": "private_list",
            "list_id": list_id,
        }

        return JSONResponse(response_data)

    except Exception as e:
        logger.exception(f"Failed to get phrases from private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists/{list_id}/categories")
@rate_limit(max_requests=30, window_seconds=60)
async def get_private_list_categories_endpoint(
    list_id: int,
    language_set_id: int = Query(...),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Get all unique categories from phrases in a private list"""
    try:
        categories = await db_manager.get_private_list_categories(list_id, user["id"], language_set_id)
        return JSONResponse(categories)
    except Exception as e:
        logger.exception(f"Failed to get categories for private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists/{list_id}/entries")
@rate_limit(max_requests=30, window_seconds=60)
async def get_private_list_entries_endpoint(
    list_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
) -> JSONResponse:
    """Return paginated phrases in a private list for management interfaces"""
    try:
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        result = await db_manager.get_private_list_entries(
            list_id, user["id"], list_info=list_info, limit=limit, offset=offset
        )

        return JSONResponse(
            {
                "list": {
                    "id": list_info["id"],
                    "list_name": list_info["list_name"],
                    "language_set_id": list_info["language_set_id"],
                    "is_system_list": list_info["is_system_list"],
                },
                "entries": result["entries"],
                "total": result["total"],
                "limit": result["limit"],
                "offset": result["offset"],
                "has_more": result["has_more"],
            }
        )

    except Exception:
        logger.exception(f"Failed to load entries for private list {list_id}")
        raise HTTPException(status_code=500, detail="Failed to load list entries")


@router.post("/user/private-lists")
@rate_limit(max_requests=10, window_seconds=60)
async def create_private_list(list_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Create a new private list for the current user"""
    try:
        list_name = list_data.get("list_name", "").strip()
        language_set_id = list_data.get("language_set_id")

        if not list_name:
            return JSONResponse({"error": "List name is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        if not language_set_id:
            return JSONResponse({"error": "Language set ID is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Create the list (duplicate check and limit check are now in create_private_list method)
        list_id = await db_manager.create_private_list(user["id"], list_name, language_set_id, is_system_list=False)

        return JSONResponse(
            {
                "id": list_id,
                "list_name": list_name,
                "language_set_id": language_set_id,
                "is_system_list": False,
                "phrase_count": 0,
            },
            status_code=status.HTTP_201_CREATED,
        )

    except ValueError as e:
        # Handle limit reached or duplicate name
        error_msg = str(e)
        if "limit reached" in error_msg.lower():
            return JSONResponse({"error": error_msg}, status_code=status.HTTP_403_FORBIDDEN)
        elif "already exists" in error_msg.lower():
            return JSONResponse({"error": error_msg}, status_code=status.HTTP_409_CONFLICT)
        return JSONResponse({"error": error_msg}, status_code=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        logger.exception("Failed to create private list")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/user/private-lists/{list_id}")
@rate_limit(max_requests=20, window_seconds=60)
async def update_private_list(list_id: int, list_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Update a private list (rename only, cannot modify system lists)"""
    try:
        new_name = list_data.get("list_name", "").strip()

        if not new_name:
            return JSONResponse({"error": "List name is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Get the list to verify ownership and check if it's a system list
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        if list_info["is_system_list"]:
            return JSONResponse({"error": "Cannot rename system lists"}, status_code=status.HTTP_403_FORBIDDEN)

        # Check for name conflicts in the same language set
        # Note: Database unique constraint will also prevent this, but we check here for better error message
        existing_lists_result = await db_manager.get_user_private_lists(
            user["id"], list_info["language_set_id"], limit=None, offset=0
        )
        existing_lists = existing_lists_result["lists"]
        if any(lst["id"] != list_id and lst["list_name"].lower() == new_name.lower() for lst in existing_lists):
            return JSONResponse({"error": "A list with this name already exists"}, status_code=status.HTTP_409_CONFLICT)

        # Update the list name
        await db_manager.update_private_list_name(list_id, new_name)

        return JSONResponse({"id": list_id, "list_name": new_name, "message": "List renamed successfully"})

    except Exception as e:
        logger.exception(f"Failed to update private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/user/private-lists/{list_id}")
@rate_limit(max_requests=20, window_seconds=60)
async def delete_private_list_endpoint(list_id: int, user=Depends(get_current_user)) -> JSONResponse:
    """Delete a private list (cannot delete system lists)"""
    try:
        # Get the list to verify ownership and check if it's a system list
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        if list_info["is_system_list"]:
            return JSONResponse({"error": "Cannot delete system lists"}, status_code=status.HTTP_403_FORBIDDEN)

        # Delete the list (cascade will remove all phrases)
        await db_manager.delete_private_list(list_id, user["id"])

        return JSONResponse({"message": "List deleted successfully", "id": list_id})

    except Exception as e:
        logger.exception(f"Failed to delete private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/private-lists/{list_id}/phrases")
@rate_limit(max_requests=30, window_seconds=60)
async def add_phrase_to_private_list(list_id: int, phrase_data: dict, user=Depends(get_current_user)) -> JSONResponse:
    """Add a phrase to a private list (either by ID or as custom phrase)"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        phrase_id = phrase_data.get("phrase_id")
        custom_phrase = phrase_data.get("custom_phrase", "").strip()
        custom_translation = phrase_data.get("custom_translation", "").strip()
        custom_categories = phrase_data.get("custom_categories", "").strip()

        # Must provide either phrase_id OR custom phrase data
        if not phrase_id and not custom_phrase:
            return JSONResponse(
                {"error": "Must provide either phrase_id or custom_phrase"}, status_code=status.HTTP_400_BAD_REQUEST
            )

        if phrase_id and custom_phrase:
            return JSONResponse(
                {"error": "Cannot provide both phrase_id and custom_phrase"}, status_code=status.HTTP_400_BAD_REQUEST
            )

        # Add the phrase
        added_id = await db_manager.add_phrase_to_private_list(
            list_id=list_id,
            phrase_id=phrase_id,
            custom_phrase=custom_phrase if custom_phrase else None,
            custom_translation=custom_translation if custom_translation else None,
            custom_categories=custom_categories if custom_categories else None,
        )

        return JSONResponse(
            {"id": added_id, "list_id": list_id, "message": "Phrase added successfully"},
            status_code=status.HTTP_201_CREATED,
        )

    except ValueError as e:
        # Handle limit reached or duplicate phrase
        error_msg = str(e)
        if "full" in error_msg.lower() or "limit" in error_msg.lower():
            return JSONResponse({"error": error_msg}, status_code=status.HTTP_403_FORBIDDEN)
        elif "already" in error_msg.lower():
            return JSONResponse({"error": error_msg}, status_code=status.HTTP_409_CONFLICT)
        return JSONResponse({"error": error_msg}, status_code=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception(f"Failed to add phrase to private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/user/private-lists/{list_id}/phrases/batch")
@rate_limit(max_requests=10, window_seconds=60)
async def batch_add_phrases_to_private_list(
    list_id: int, phrases: list[dict] = Body(...), user=Depends(get_current_user)
) -> JSONResponse:
    """Batch add multiple phrases to a private list from CSV/JSON import

    Expected format:
    [
        {"phrase": "hello", "translation": "bok", "categories": "Greetings"},
        {"phrase": "goodbye", "translation": "doviđenja", "categories": "Greetings"}
    ]
    """
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        # Validate phrases
        if not phrases or len(phrases) > 1000:
            return JSONResponse(
                {"error": "Invalid batch size. Must be between 1 and 1000 phrases"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        added = []
        errors = []

        for idx, phrase_data in enumerate(phrases):
            try:
                phrase = phrase_data.get("phrase", "").strip()
                translation = phrase_data.get("translation", "").strip()
                categories = phrase_data.get("categories", "").strip()

                if not phrase or not translation:
                    errors.append({"index": idx, "phrase": phrase, "error": "Phrase and translation are required"})
                    continue

                if len(phrase) > 200 or len(translation) > 200:
                    errors.append(
                        {"index": idx, "phrase": phrase, "error": "Phrase or translation too long (max 200 characters)"}
                    )
                    continue

                # Add custom phrase
                added_id = await db_manager.add_phrase_to_private_list(
                    list_id=list_id,
                    custom_phrase=phrase,
                    custom_translation=translation,
                    custom_categories=categories if categories else None,
                )

                if added_id:
                    added.append({"index": idx, "phrase": phrase, "translation": translation, "id": added_id})

            except Exception:
                errors.append({"index": idx, "phrase": phrase_data.get("phrase", ""), "error": "Failed to add phrase"})

        return JSONResponse(
            {
                "added_count": len(added),
                "error_count": len(errors),
                "added": added[:10],  # Return first 10 for preview
                "errors": errors[:10],  # Return first 10 errors
                "total_processed": len(phrases),
            }
        )

    except Exception:
        logger.exception(f"Failed to batch add phrases to private list {list_id}")
        raise HTTPException(status_code=500, detail="Batch import failed")


@router.delete("/user/private-lists/{list_id}/phrases/{phrase_entry_id}")
@rate_limit(max_requests=30, window_seconds=60)
async def remove_phrase_from_private_list(
    list_id: int, phrase_entry_id: int, user=Depends(get_current_user)
) -> JSONResponse:
    """Remove a phrase from a private list"""
    try:
        # Verify list ownership
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            return JSONResponse({"error": "List not found"}, status_code=status.HTTP_404_NOT_FOUND)

        # Remove the phrase
        success = await db_manager.remove_phrase_from_private_list(list_id, phrase_entry_id)

        if not success:
            return JSONResponse({"error": "Phrase not found in this list"}, status_code=status.HTTP_404_NOT_FOUND)

        return JSONResponse(
            {"message": "Phrase removed successfully", "list_id": list_id, "phrase_entry_id": phrase_entry_id},
            status_code=status.HTTP_200_OK,
        )

    except Exception as e:
        logger.exception(f"Failed to remove phrase from private list {list_id}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/private-lists/{list_id}/statistics")
@rate_limit(max_requests=30, window_seconds=60)
async def get_list_statistics(list_id: int, user=Depends(get_current_user)) -> JSONResponse:
    """Get usage statistics for a specific list"""
    try:
        # Check access (owner or shared)
        access = await db_manager.check_list_access(list_id, user["id"])
        if not access:
            return JSONResponse({"error": "List not found or access denied"}, status_code=status.HTTP_404_NOT_FOUND)

        # For now, only owner can view full statistics
        if access["access_type"] != "owner":
            return JSONResponse(
                {"error": "Only the list owner can view statistics"}, status_code=status.HTTP_403_FORBIDDEN
            )

        stats = await db_manager.get_list_statistics(list_id, user["id"])

        if not stats:
            return JSONResponse({"error": "Statistics not available"}, status_code=status.HTTP_404_NOT_FOUND)

        return JSONResponse(stats)

    except Exception:
        logger.exception(f"Failed to get statistics for list {list_id}")
        raise HTTPException(status_code=500, detail="Failed to get statistics")


@router.get("/user/lists/statistics")
@rate_limit(max_requests=30, window_seconds=60)
async def get_user_list_statistics(user=Depends(get_current_user)) -> JSONResponse:
    """Get aggregate statistics for all user lists"""
    try:
        stats = await db_manager.get_user_list_statistics(user["id"])

        return JSONResponse(stats)

    except Exception:
        logger.exception("Failed to get user list statistics")
        raise HTTPException(status_code=500, detail="Failed to get statistics")


@router.get("/user/private-lists/{list_id}/export")
@rate_limit(max_requests=10, window_seconds=60)
async def export_private_list(
    list_id: int,
    user=Depends(get_current_user),
) -> StreamingResponse:
    """Export a private list as CSV"""
    try:
        # Check access (owner or shared)
        access = await db_manager.check_list_access(list_id, user["id"])
        if not access:
            raise HTTPException(status_code=404, detail="List not found or access denied")

        # Get list info
        list_info = await db_manager.get_private_list_by_id(list_id, user["id"])
        if not list_info:
            raise HTTPException(status_code=404, detail="List not found")

        # Get all entries (no pagination for export)
        result = await db_manager.get_private_list_entries(
            list_id, user["id"], list_info=list_info, limit=None, offset=0
        )
        entries = result["entries"]

        # Export as CSV with UTF-8 BOM for proper encoding
        output = io.StringIO()
        # Write UTF-8 BOM for Excel compatibility
        output.write("\ufeff")
        csv_writer = csv.writer(output, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL)

        # Write header
        csv_writer.writerow(["phrase", "translation", "categories", "source", "added_at"])

        # Write data rows
        for entry in entries:
            phrase = entry.get("phrase", "")
            translation = entry.get("translation", "").replace("\n", "<br>")
            categories = entry.get("categories", "")
            source = entry.get("source", "unknown")
            added_at = entry.get("added_at", "")

            csv_writer.writerow([phrase, translation, categories, source, added_at])

        content = output.getvalue()
        output.close()

        safe_list_name = re.sub(r"[^a-z0-9]+", "_", list_info["list_name"].lower())
        filename = f"list_{safe_list_name}.csv"

        return StreamingResponse(
            io.BytesIO(content.encode("utf-8-sig")),  # utf-8-sig includes BOM
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": "text/csv; charset=utf-8",
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Failed to export list {list_id}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

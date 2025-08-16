"""Phrase management endpoints for admin API"""

import csv
import io

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import require_admin_access, require_root_admin
from osmosmjerka.cache import rate_limit, categories_cache
from osmosmjerka.database import db_manager

router = APIRouter()


def _parse_phrases_csv(content: str) -> tuple[list[dict], str]:
    """Parse semicolon-separated CSV content into phrase dicts with preserved line breaks.
    
    Returns:
        tuple: (phrases_data, error_message) - error_message is empty string if successful
    """
    # Use CSV reader to properly handle semicolon-separated values and preserve line breaks
    lines = content.strip().split("\n")
    
    if not lines or not lines[0].strip():
        return [], "File is empty or contains only whitespace"
    
    # Check if first line looks like it should be data but has wrong format
    first_line = lines[0].strip()
    if first_line and ";" not in first_line:
        return [], "Invalid file format. Expected semicolon-separated values (;). First line: '" + first_line + "'. Expected format: 'category;phrase;translation'"
    
    # Parse first line to check column count
    try:
        csv_reader = csv.reader([first_line], delimiter=";", quotechar='"')
        first_parts = next(csv_reader)
        if len(first_parts) < 3:
            return [], f"Invalid file format. Expected at least 3 columns (category;phrase;translation), but found {len(first_parts)} column(s) in first line. First line: '{first_line}'"
    except csv.Error as e:
        return [], f"CSV parsing error in first line: {e}. Line: '{first_line}'"

    # Skip header if present - only skip if it explicitly looks like a header
    if lines and lines[0].lower().strip() in ["categories;phrase;translation", "category;phrase;translation", "categories;phrases;translations"]:
        lines = lines[1:]
        if not lines:
            return [], "File contains only header row. Please add data rows with format: category;phrase;translation"

    phrases_data: list[dict] = []
    errors = []
    
    for line_num, line in enumerate(lines, start=2 if lines != content.strip().split("\n") else 1):  # Adjust line numbers based on header
        if not line.strip():
            continue

        try:
            # Use CSV reader with semicolon delimiter to properly parse fields
            csv_reader = csv.reader([line], delimiter=";", quotechar='"')
            parts = next(csv_reader)

            if len(parts) >= 3:
                categories = parts[0].strip()
                phrase = parts[1].strip()
                translation = parts[2].strip()
                
                if not categories or not phrase or not translation:
                    errors.append(f"Line {line_num}: Empty required field(s). All three fields (category, phrase, translation) must be non-empty")
                    continue

                # Preserve line breaks: normalize different line break formats
                translation = (
                    translation.replace("\\n", "\n")
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n")
                )

                phrases_data.append({"categories": categories, "phrase": phrase, "translation": translation})
            else:
                errors.append(f"Line {line_num}: Expected 3 columns but found {len(parts)}. Line: '{line}'")

        except csv.Error as e:
            errors.append(f"Line {line_num}: CSV parsing error: {e}")
            continue
    
    if not phrases_data and errors:
        return [], f"No valid phrases found. Errors: {'; '.join(errors[:3])}{'...' if len(errors) > 3 else ''}"
    elif not phrases_data:
        return [], "No valid phrases found. Please ensure your file has the format: category;phrase;translation"
        
    return phrases_data, ""


@router.get("/status")
def admin_status(user=Depends(require_admin_access)) -> JSONResponse:
    return JSONResponse({"status": "ok", "user": user}, status_code=status.HTTP_200_OK)


@router.get("/rows")
@rate_limit(max_requests=60, window_seconds=60)  # 60 requests per minute for admin browsing
async def get_all_rows(
    offset: int = 0,
    limit: int = 20,
    category: str = Query(None),
    search: str = Query(None),
    language_set_id: int = Query(None),
    user=Depends(require_admin_access),
) -> dict:
    """Get phrases for admin panel with language set support"""
    rows = await db_manager.get_phrases_for_admin(language_set_id, category, limit, offset, search)
    total = await db_manager.get_phrase_count_for_admin(language_set_id, category, search)
    return {"rows": rows, "total": total}


@router.post("/row")
@rate_limit(max_requests=30, window_seconds=60)  # 30 additions per minute
async def add_row(row: dict, language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Add a new phrase to specified language set"""
    try:
        await db_manager.add_phrase(language_set_id, row["categories"], row["phrase"], row["translation"])
        # Track statistics for phrase addition
        await db_manager.record_phrase_operation(user["id"], language_set_id, "added")
        # Invalidate relevant caches
        categories_cache.invalidate(f"categories_{language_set_id}")
        return JSONResponse({"message": "Phrase added"}, status_code=status.HTTP_201_CREATED)
    except Exception as e:
        return JSONResponse({"error": f"Failed to add phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.put("/row/{id}")
async def update_row(
    id: int, row: dict, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Update an existing phrase"""
    try:
        await db_manager.update_phrase(id, language_set_id, row["categories"], row["phrase"], row["translation"])
        # Track statistics for phrase editing
        await db_manager.record_phrase_operation(user["id"], language_set_id, "edited")
        return JSONResponse({"message": "Phrase updated"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to update phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/row/{id}")
async def delete_row(id: int, language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Delete a phrase"""
    try:
        await db_manager.delete_phrase(id, language_set_id)
        return JSONResponse({"message": "Phrase deleted"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete phrase: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/clear")
async def clear_db(language_set_id: int = Query(...), user=Depends(require_root_admin)) -> JSONResponse:
    """Clear all phrases for a specific language set - root admin only"""
    try:
        await db_manager.clear_all_phrases(language_set_id)
        return JSONResponse({"message": "Language set phrases cleared"}, status_code=status.HTTP_200_OK)
    except Exception as e:
        return JSONResponse({"error": f"Failed to clear phrases: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.post("/upload")
async def upload(
    file: UploadFile = File(...), language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Upload CSV file with phrases to specified language set
    
    Expected file format:
    - Semicolon-separated values (CSV)
    - Three columns: categories;phrase;translation
    - Optional header line: categories;phrase;translation
    - Example:
        categories;phrase;translation
        greeting;hello;привет
        greeting;goodbye;до свидания
    """
    try:
        content = (await file.read()).decode("utf-8")
        phrases_data, error_message = _parse_phrases_csv(content)
        
        if error_message:
            return JSONResponse(
                {"error": error_message}, status_code=status.HTTP_400_BAD_REQUEST
            )
            
        if phrases_data:
            await run_in_threadpool(db_manager.fast_bulk_insert_phrases, language_set_id, phrases_data)
            # Track statistics for bulk phrase addition
            for _ in range(len(phrases_data)):
                await db_manager.record_phrase_operation(user["id"], language_set_id, "added")
            return JSONResponse(
                {"message": f"Uploaded {len(phrases_data)} phrases"}, status_code=status.HTTP_201_CREATED
            )
        else:
            return JSONResponse(
                {"error": "Upload failed - no valid phrases found"}, status_code=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        return JSONResponse({"error": f"Upload failed: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.get("/all-categories")
async def get_all_categories(language_set_id: int = Query(None), user=Depends(require_admin_access)) -> JSONResponse:
    """Get all categories including ignored ones for admin panel with language set support"""
    categories = await db_manager.get_all_categories_for_language_set(language_set_id)
    return JSONResponse(categories)


@router.get("/duplicates")
async def find_duplicates(language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Find duplicate phrases in specified language set
    
    Returns groups of duplicate phrases where each group contains records that have
    the same phrase text (case-insensitive) within the same language set.
    """
    try:
        duplicates = await db_manager.find_duplicate_phrases(language_set_id)
        return JSONResponse(duplicates)
    except Exception as e:
        return JSONResponse({"error": f"Failed to find duplicates: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/duplicates")
async def delete_duplicate_phrases(
    phrase_ids: list[int], language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Delete specific duplicate phrases by their IDs
    
    Body should contain a JSON array of phrase IDs to delete.
    """
    try:
        if not phrase_ids:
            return JSONResponse({"error": "No phrase IDs provided"}, status_code=status.HTTP_400_BAD_REQUEST)
        
        deleted_count = await db_manager.delete_phrases_by_ids(phrase_ids, language_set_id)
        
        # Track statistics for phrase deletion
        for _ in range(deleted_count):
            await db_manager.record_phrase_operation(user["id"], language_set_id, "deleted")
            
        return JSONResponse({
            "message": f"Deleted {deleted_count} duplicate phrases",
            "deleted_count": deleted_count
        })
    except Exception as e:
        return JSONResponse({"error": f"Failed to delete duplicates: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.get("/export")
@rate_limit(max_requests=5, window_seconds=60)  # 5 exports per minute
async def export_data(
    category: str = Query(None), language_set_id: int = Query(None), user=Depends(require_admin_access)
) -> StreamingResponse:
    """Export phrases as CSV from specified language set"""
    try:
        rows = await db_manager.get_phrases(language_set_id, category)
        output = io.StringIO()

        # Use CSV writer to properly handle semicolon delimiter and escape special characters
        csv_writer = csv.writer(output, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL)

        # Write header
        csv_writer.writerow(["categories", "phrase", "translation"])

        # Write data rows
        for row in rows:
            categories = row["categories"]
            phrase = row["phrase"]
            translation = row["translation"]

            # Normalize line breaks for export (use <br> for HTML compatibility)
            translation_export = translation.replace("\n", "<br>")

            csv_writer.writerow([categories, phrase, translation_export])

        content = output.getvalue()
        output.close()

        # Get language set info for filename
        language_set = None
        if language_set_id:
            language_set = await db_manager.get_language_set_by_id(language_set_id)

        language_name = language_set["name"] if language_set else "default"
        filename = f"export_{language_name}_{category or 'all'}.csv"

        return StreamingResponse(
            io.StringIO(content),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        # For errors, we need to return a proper error response but with correct type
        error_content = f"Export failed: {str(e)}"
        return StreamingResponse(io.StringIO(error_content), media_type="text/plain", status_code=400)

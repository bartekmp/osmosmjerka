"""Phrase management endpoints for admin API"""

import csv
import io
import re
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import require_admin_access, require_root_admin
from osmosmjerka.cache import categories_cache, rate_limit
from osmosmjerka.database import db_manager

router = APIRouter()


def _parse_phrases_csv(content: str, delimiter: Optional[str] = None) -> tuple[list[dict], str]:
    """Parse delimited content into phrase dicts with preserved line breaks.

    - Auto-detects delimiter from the first non-empty line if not provided.
    - Supports header line like: categories<sep>phrase<sep>translation (defines the separator).

    Returns:
        tuple: (phrases_data, error_message) - error_message is empty string if successful
    """
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    raw_lines = content.split("\n")
    # Keep original for line number math
    stripped_nonempty = [ln for ln in raw_lines if ln.strip()]

    if not stripped_nonempty:
        return [], "File is empty or contains only whitespace"

    # Determine delimiter
    first_line = stripped_nonempty[0].strip().lstrip("\ufeff").lower()
    detected_delim: str
    if delimiter:
        detected_delim = "\t" if delimiter == "tab" else delimiter
    else:
        candidates = [";", ",", "|", "\t"]
        # Prefer explicit header pattern
        detected_delim = None  # type: ignore
        for d in candidates:
            if f"categories{d}phrase{d}translation" in first_line or f"category{d}phrase{d}translation" in first_line:
                detected_delim = d
                break
        if not detected_delim:
            # Choose the delimiter with max count in first line among supported candidates
            counts = {d: first_line.count(d) for d in candidates}
            max_delim = max(counts, key=lambda d: counts[d])
            if counts[max_delim] == 0:
                # No supported delimiter found in the first line and no header match -> invalid format
                return (
                    [],
                    "Invalid file format. Expected delimited values with one of: ';', ',', '|', or TAB. First line: '"
                    + stripped_nonempty[0]
                    + "'. Expected format: 'categories;phrase;translation'",
                )
            detected_delim = max_delim

    # Validate first line has at least 3 columns using detected delimiter
    try:
        csv_reader = csv.reader([stripped_nonempty[0]], delimiter=detected_delim, quotechar='"')
        first_parts = next(csv_reader)
        if len(first_parts) < 3:
            return (
                [],
                f"Invalid file format. Expected at least 3 columns (categories{detected_delim}phrase{detected_delim}translation), but found {len(first_parts)} column(s) in first line. First line: '{stripped_nonempty[0]}'",
            )
    except csv.Error as e:
        return [], f"CSV parsing error in first line: {e}. Line: '{stripped_nonempty[0]}'"

    # Build lines list and detect header presence (using detected delimiter)
    lines = raw_lines[:]
    header_patterns = {
        f"categories{detected_delim}phrase{detected_delim}translation",
        f"category{detected_delim}phrase{detected_delim}translation",
        f"categories{detected_delim}phrases{detected_delim}translations",
    }
    first_nonempty_index = next((i for i, ln in enumerate(lines) if ln.strip()), 0)
    header_present = lines and lines[first_nonempty_index].strip().lstrip("\ufeff").lower() in header_patterns
    if header_present:
        # Drop only that first non-empty header line; keep original newlines for correct numbering
        del lines[first_nonempty_index]
        if not any(ln.strip() for ln in lines):
            return [], (
                "File contains only header row. Please add data rows with format: "
                f"categories{detected_delim}phrase{detected_delim}translation"
            )

    phrases_data: list[dict] = []
    errors = []

    # Starting line number accounting for header
    start_num = 2 if header_present else 1
    effective_content_lines = [ln for ln in lines if ln.strip()]
    for idx, line in enumerate(effective_content_lines, start=start_num):
        try:
            csv_reader = csv.reader([line], delimiter=detected_delim, quotechar='"')
            parts = next(csv_reader)

            if len(parts) >= 3:
                categories = parts[0].strip()
                phrase = parts[1].strip()
                translation = parts[2].strip()

                if not categories or not phrase or not translation:
                    errors.append(
                        f"Line {idx}: Empty required field(s). All three fields (category, phrase, translation) must be non-empty"
                    )
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
                errors.append(f"Line {idx}: Expected 3 columns but found {len(parts)}. Line: '{line}'")

        except csv.Error as e:
            errors.append(f"Line {idx}: CSV parsing error: {e}")
            continue

    if not phrases_data and errors:
        return [], f"No valid phrases found. Errors: {'; '.join(errors[:3])}{'...' if len(errors) > 3 else ''}"
    elif not phrases_data:
        return [], (
            "No valid phrases found. Please ensure your file has the format: "
            f"categories{detected_delim}phrase{detected_delim}translation"
        )

    return phrases_data, ""


def _extract_error_details(message: str) -> tuple[Optional[int], Optional[str]]:
    """Try to extract first error line number and content from an error message string.

    Returns (line_num, line_content) if found, else (None, None).
    """
    # Pattern like: "Line 5: ... Line: 'the raw line'"
    m = re.search(r"Line\s+(\d+).*?Line:\s*'([^']*)'", message)
    if m:
        try:
            return int(m.group(1)), m.group(2)
        except Exception:
            return None, m.group(2)

    # Pattern like: "Line 5: ..." (without explicit raw line)
    m2 = re.search(r"Line\s+(\d+):", message)
    if m2:
        try:
            return int(m2.group(1)), None
        except Exception:
            return None, None

    # For invalid format with first line content present in message
    m3 = re.search(r"First line:\s*'([^']*)'", message)
    if m3:
        return 1, m3.group(1)

    return None, None


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
            ln, lc = _extract_error_details(error_message)
            return JSONResponse(
                {"error": error_message, "first_error_line_num": ln, "first_error_line": lc},
                status_code=status.HTTP_400_BAD_REQUEST,
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


@router.post("/upload-text")
async def upload_text(
    request: Request, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Upload phrases from raw text body.

    Body JSON:
    {
        "content": "categories;phrase;translation\ncat1;hello;hola",
        "separator": ";" | "," | "|" | "tab"   // optional, when omitted, auto-detect from first line
    }
    """
    try:
        payload = await request.json()
        content = (payload.get("content") or "").strip()
        if not content:
            return JSONResponse({"error": "Content cannot be empty"}, status_code=status.HTTP_400_BAD_REQUEST)

        sep = payload.get("separator")
        phrases_data, error_message = _parse_phrases_csv(content, sep)

        if error_message:
            ln, lc = _extract_error_details(error_message)
            return JSONResponse(
                {"error": error_message, "first_error_line_num": ln, "first_error_line": lc},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if phrases_data:
            await run_in_threadpool(db_manager.fast_bulk_insert_phrases, language_set_id, phrases_data)
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
async def find_duplicates(
    language_set_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    user=Depends(require_admin_access),
) -> JSONResponse:
    """Find duplicate phrases in specified language set with pagination

    Returns groups of duplicate phrases where each group contains records that have
    the same phrase text (case-insensitive) within the same language set.
    """
    try:
        duplicates = await db_manager.find_duplicate_phrases(language_set_id)

        # Apply pagination
        total_count = len(duplicates)
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_duplicates = duplicates[start_index:end_index]

        return JSONResponse(
            {
                "duplicates": paginated_duplicates,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "total_pages": (total_count + page_size - 1) // page_size,
            }
        )
    except Exception as e:
        return JSONResponse({"error": f"Failed to find duplicates: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.delete("/duplicates")
async def delete_duplicate_phrases(
    request: Request, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Delete specific duplicate phrases by their IDs

    Body should contain a JSON array of phrase IDs to delete.
    """
    try:
        # Get the request body as JSON
        request_data = await request.json()

        # Handle both list and dict formats
        if isinstance(request_data, list):
            phrase_ids = request_data
        elif isinstance(request_data, dict) and "phrase_ids" in request_data:
            phrase_ids = request_data["phrase_ids"]
        else:
            return JSONResponse(
                {"error": "Invalid request format. Expected array of phrase IDs or object with 'phrase_ids' field"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        if not phrase_ids:
            return JSONResponse({"error": "No phrase IDs provided"}, status_code=status.HTTP_400_BAD_REQUEST)

        # Get phrases before deletion to identify remaining ones
        phrases_to_delete = await db_manager.get_phrases_by_ids(phrase_ids, language_set_id)

        # Group phrases by their text to find what remains
        remaining_phrases = []
        if phrases_to_delete:
            # Get the phrase text from the first phrase to delete
            phrase_text = phrases_to_delete[0]["phrase"].lower().strip()

            # Find all duplicates for this phrase text
            all_duplicates = await db_manager.find_duplicate_phrases(language_set_id)

            # Find the group that contains our phrase text
            for duplicate_group in all_duplicates:
                if duplicate_group["phrase_text"].lower().strip() == phrase_text:
                    # Get phrases that will remain (not in deletion list)
                    remaining_phrases = [
                        phrase for phrase in duplicate_group["duplicates"] if phrase["id"] not in phrase_ids
                    ]
                    break

        deleted_count = await db_manager.delete_phrases_by_ids(phrase_ids, language_set_id)

        # Track statistics for phrase deletion
        for _ in range(deleted_count):
            await db_manager.record_phrase_operation(user["id"], language_set_id, "deleted")

        return JSONResponse(
            {
                "message": f"Deleted {deleted_count} duplicate phrases",
                "deleted_count": deleted_count,
                "remaining_phrases": remaining_phrases,
            }
        )
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to delete duplicates: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST
        )


@router.post("/merge-categories")
async def merge_duplicate_categories(
    request: Request, language_set_id: int = Query(...), user=Depends(require_admin_access)
) -> JSONResponse:
    """Merge categories from duplicate phrases into a selected phrase and delete the others

    Body should contain:
    {
        "keep_phrase_id": int,  // ID of the phrase to keep
        "duplicate_phrase_ids": [int, ...]  // IDs of the duplicate phrases to merge and delete
    }
    """
    try:
        # Get the request body as JSON
        request_data = await request.json()

        keep_phrase_id = request_data.get("keep_phrase_id")
        duplicate_phrase_ids = request_data.get("duplicate_phrase_ids", [])

        if not keep_phrase_id:
            return JSONResponse({"error": "keep_phrase_id is required"}, status_code=status.HTTP_400_BAD_REQUEST)

        if not duplicate_phrase_ids:
            return JSONResponse(
                {"error": "duplicate_phrase_ids is required and cannot be empty"},
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        # Get all phrases that will be involved in the merge
        all_phrase_ids = [keep_phrase_id] + duplicate_phrase_ids
        phrases = await db_manager.get_phrases_by_ids(all_phrase_ids, language_set_id)

        if not phrases:
            return JSONResponse(
                {"error": "No phrases found with the provided IDs"}, status_code=status.HTTP_404_NOT_FOUND
            )

        # Find the phrase to keep
        keep_phrase = None
        duplicate_phrases = []

        for phrase in phrases:
            if phrase["id"] == keep_phrase_id:
                keep_phrase = phrase
            elif phrase["id"] in duplicate_phrase_ids:
                duplicate_phrases.append(phrase)

        if not keep_phrase:
            return JSONResponse(
                {"error": f"Keep phrase with ID {keep_phrase_id} not found"}, status_code=status.HTTP_404_NOT_FOUND
            )

        if not duplicate_phrases:
            return JSONResponse(
                {"error": "No duplicate phrases found with the provided IDs"}, status_code=status.HTTP_404_NOT_FOUND
            )

        # Collect all unique categories from all phrases
        all_categories = set()
        original_categories = []

        # Add categories from the phrase we're keeping
        if keep_phrase["categories"]:
            keep_cats = [cat.strip() for cat in keep_phrase["categories"].split() if cat.strip()]
            all_categories.update(keep_cats)
            original_categories.extend(keep_cats)

        # Add categories from duplicate phrases
        for dup_phrase in duplicate_phrases:
            if dup_phrase["categories"]:
                dup_cats = [cat.strip() for cat in dup_phrase["categories"].split() if cat.strip()]
                all_categories.update(dup_cats)
                original_categories.extend(dup_cats)

        # Create the merged categories string (sorted and deduplicated, space-separated)
        merged_categories = " ".join(sorted(all_categories))

        # Count duplicates that were removed
        original_count = len(original_categories)
        unique_count = len(all_categories)

        # Update the kept phrase with merged categories
        await db_manager.update_phrase_categories(keep_phrase_id, merged_categories, language_set_id)

        # Delete the duplicate phrases
        deleted_count = await db_manager.delete_phrases_by_ids(duplicate_phrase_ids, language_set_id)

        # Track statistics
        await db_manager.record_phrase_operation(user["id"], language_set_id, "edited")  # For the merge
        for _ in range(deleted_count):
            await db_manager.record_phrase_operation(user["id"], language_set_id, "deleted")

        return JSONResponse(
            {
                "message": f"Successfully merged categories and deleted {deleted_count} duplicate phrases",
                "kept_phrase_id": keep_phrase_id,
                "kept_phrase": {
                    "id": keep_phrase_id,
                    "categories": merged_categories,
                    "phrase": keep_phrase["phrase"],
                    "translation": keep_phrase["translation"],
                },
                "merged_categories": merged_categories,
                "deleted_count": deleted_count,
                "category_stats": {
                    "original_category_count": original_count,
                    "unique_category_count": unique_count,
                    "duplicates_removed": original_count - unique_count,
                },
            }
        )

    except Exception as e:
        return JSONResponse({"error": f"Failed to merge categories: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


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

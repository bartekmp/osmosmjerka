"""Phrase management endpoints for admin API"""

import csv
import io

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from osmosmjerka.auth import require_admin_access, require_root_admin
from osmosmjerka.database import db_manager

router = APIRouter()


def _parse_phrases_csv(content: str) -> list[dict]:
    """Parse semicolon-separated CSV content into phrase dicts with preserved line breaks."""
    # Use CSV reader to properly handle semicolon-separated values and preserve line breaks
    lines = content.strip().split("\n")

    # Skip header if present
    if lines and (lines[0].lower().startswith("categories") or ";" in lines[0]):
        lines = lines[1:]

    phrases_data: list[dict] = []
    for line_num, line in enumerate(lines, start=2):  # Start at 2 to account for header
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

                # Preserve line breaks: normalize different line break formats
                translation = (
                    translation.replace("\\n", "\n")
                    .replace("<br>", "\n")
                    .replace("<br/>", "\n")
                    .replace("<br />", "\n")
                )

                phrases_data.append({"categories": categories, "phrase": phrase, "translation": translation})
            else:
                print(f"Warning: Line {line_num} has insufficient columns: {len(parts)}")

        except csv.Error as e:
            print(f"Error parsing line {line_num}: {e}")
            continue

    return phrases_data


@router.get("/status")
def admin_status(user=Depends(require_admin_access)) -> JSONResponse:
    return JSONResponse({"status": "ok", "user": user}, status_code=status.HTTP_200_OK)


@router.get("/rows")
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
async def add_row(row: dict, language_set_id: int = Query(...), user=Depends(require_admin_access)) -> JSONResponse:
    """Add a new phrase to specified language set"""
    try:
        await db_manager.add_phrase(language_set_id, row["categories"], row["phrase"], row["translation"])
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
    """Upload CSV file with phrases to specified language set"""
    try:
        content = (await file.read()).decode("utf-8")
        phrases_data = _parse_phrases_csv(content)
        if phrases_data:
            await run_in_threadpool(db_manager.fast_bulk_insert_phrases, language_set_id, phrases_data)
            return JSONResponse(
                {"message": f"Uploaded {len(phrases_data)} phrases"}, status_code=status.HTTP_201_CREATED
            )
        else:
            return JSONResponse(
                {"message": "Upload failed - no valid phrases found"}, status_code=status.HTTP_400_BAD_REQUEST
            )
    except Exception as e:
        return JSONResponse({"error": f"Upload failed: {str(e)}"}, status_code=status.HTTP_400_BAD_REQUEST)


@router.get("/all-categories")
async def get_all_categories(language_set_id: int = Query(None), user=Depends(require_admin_access)) -> JSONResponse:
    """Get all categories including ignored ones for admin panel with language set support"""
    categories = await db_manager.get_all_categories_for_language_set(language_set_id)
    return JSONResponse(categories)


@router.get("/export")
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

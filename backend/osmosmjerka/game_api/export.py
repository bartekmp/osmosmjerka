"""Export functionality for game API."""

import io
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from osmosmjerka.cache import rate_limit
from osmosmjerka.game_api.schemas import ExportPuzzleRequest
from osmosmjerka.utils import export_to_docx, export_to_png

router = APIRouter()


@router.post("/export")
@rate_limit(max_requests=5, window_seconds=60)  # 5 exports per minute
async def export_puzzle(body: ExportPuzzleRequest) -> StreamingResponse:
    """Export puzzle in specified format (docx or png)"""
    try:
        if body.format == "docx":
            content = export_to_docx(body.category, body.grid, body.phrases)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            extension = "docx"
        elif body.format == "png":
            content = export_to_png(body.category, body.grid, body.phrases)
            media_type = "image/png"
            extension = "png"
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format")

        safe_category = re.sub(r"[^a-z0-9]+", "_", (body.category or "wordsearch").lower())
        filename = f"wordsearch-{safe_category}.{extension}"

        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}") from e

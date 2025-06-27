from io import BytesIO

from docx import Document
from docx.shared import Pt


def export_to_docx(category: str, grid: list, words: list) -> bytes:
    """Export the word search grid and words to a DOCX file.
    Args:
        category (str): The category of the word search.
        grid (list): The word search grid as a list of lists.
        words (list): A list of dictionaries with "word" and "translation" keys.
    Returns:
        bytes: The DOCX file content as bytes.
    """
    if not category or not grid or not words:
        raise ValueError("Category, grid, and words must be provided.")
    doc = Document()
    doc.add_heading(category, 0)
    table = "\n".join([" ".join(row) for row in grid])
    p = doc.add_paragraph()
    run = p.add_run(table)
    run.font.name = "Courier New"
    run.font.size = Pt(10)
    doc.add_paragraph("\n".join([w["word"] for w in words]))
    output = BytesIO()
    doc.save(output)
    return output.getvalue()

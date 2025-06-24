from io import BytesIO

from docx import Document
from docx.shared import Pt


def export_to_docx(category, grid, words):
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

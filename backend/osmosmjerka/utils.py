from io import BytesIO

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

from PIL import Image, ImageDraw, ImageFont


def export_to_docx(category: str, grid: list, phrases: list) -> bytes:
    """Export the phrase search grid and phrases to a DOCX file.

    Args:
        category (str): The category of the phrase search.
        grid (list): The phrase search grid as a list of lists.
        phrases (list): A list of dictionaries with "phrase" and "translation" keys.

    Returns:
        bytes: The DOCX file content as bytes.
    """
    if not category or not grid or not phrases:
        raise ValueError("Category, grid, and phrases must be provided.")
    doc = Document()
    # Uppercase header with category name, centered
    heading = doc.add_heading(category.upper(), 0)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Letter grid, monospace font, centered, no borders
    table = doc.add_table(rows=len(grid), cols=len(grid[0]))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False  # Turn off auto-fit

    # Remove all borders
    tbl = table._tbl
    for border in tbl.xpath(".//w:tblBorders"):
        border.getparent().remove(border)

    # Set the cell width and height to 0.8 cm
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            cell_obj = table.cell(r, c)
            cell_obj.text = cell
            cell_obj.width = Cm(0.8)
            for p in cell_obj.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for run in p.runs:
                    run.font.name = "Courier New"
                    run.font.size = Pt(12)
                    run.bold = True  # Make grid letters bold

    # Set row height for uniform appearance
    for row in table.rows:
        row.height = Cm(0.8)

    doc.add_paragraph()  # Add a blank line for spacing

    # Convert phrases to uppercase and join them with commas
    phrases_line = ", ".join(w["phrase"].upper() for w in phrases)
    p = doc.add_paragraph(phrases_line)
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    for run in p.runs:
        run.font.name = "Arial"
        run.font.size = Pt(11)
        run.bold = True  # Make phrases bold

    output = BytesIO()
    doc.save(output)
    return output.getvalue()


def export_to_png(category: str, grid: list, phrases: list) -> bytes:
    """Export the phrase search grid and phrases to a PNG image.

    Args:
        category (str): The category of the phrase search.
        grid (list): The phrase search grid as a list of lists.
        phrases (list): A list of dictionaries with "phrase" and "translation" keys.

    Returns:
        bytes: The PNG file content as bytes.
    """
    if not category or not grid or not phrases:
        raise ValueError("Category, grid, and phrases must be provided.")

    grid_size = len(grid)
    cell_size = max(30, min(50, 800 // grid_size))  # Adaptive cell size
    margin = 50
    title_height = 60
    phrases_height = 100
    grid_width = grid_size * cell_size
    grid_height = grid_size * cell_size
    image_width = grid_width + (2 * margin)
    image_height = grid_height + title_height + phrases_height + (2 * margin)
    img = Image.new("RGB", (image_width, image_height), "white")
    draw = ImageDraw.Draw(img)

    # Try to use a font with UTF-8 support (DejaVuSans)
    try:
        title_font = ImageFont.truetype("fonts/DejaVuSans-Bold.ttf", 24)
        grid_font = ImageFont.truetype("fonts/DejaVuSans-Bold.ttf", max(18, cell_size // 2))
        phrases_font = ImageFont.truetype("fonts/DejaVuSans-Bold.ttf", 16)
    except OSError:
        try:
            title_font = ImageFont.truetype("fonts/arialbd.ttf", 24)
            grid_font = ImageFont.truetype("fonts/arialbd.ttf", max(18, cell_size // 2))
            phrases_font = ImageFont.truetype("fonts/arialbd.ttf", 16)
        except OSError:
            title_font = ImageFont.load_default()
            grid_font = ImageFont.load_default()
            phrases_font = ImageFont.load_default()

    # Draw title
    title_text = category.upper()
    title_bbox = draw.textbbox((0, 0), title_text, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (image_width - title_width) // 2
    draw.text((title_x, margin), title_text, fill="black", font=title_font)

    # Draw grid
    grid_start_y = margin + title_height
    grid_start_x = margin

    for i, row in enumerate(grid):
        for j, cell in enumerate(row):
            x = grid_start_x + (j * cell_size)
            y = grid_start_y + (i * cell_size)

            # Draw cell border
            draw.rectangle([x, y, x + cell_size, y + cell_size], outline="black", width=1)

            # Draw cell text
            text_bbox = draw.textbbox((0, 0), cell, font=grid_font)
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = x + (cell_size - text_width) // 2
            text_y = y + (cell_size - text_height) // 2
            draw.text((text_x, text_y), cell, fill="black", font=grid_font)

    # Draw phrases
    phrases_text = ", ".join(w["phrase"].upper() for w in phrases)
    phrases_y = grid_start_y + grid_height + 30

    # Split phrases into multiple lines if too long
    max_width = image_width - (2 * margin)
    phrases_lines = []
    current_line = ""

    for phrase in phrases_text.split(", "):
        test_line = current_line + (", " if current_line else "") + phrase
        test_bbox = draw.textbbox((0, 0), test_line, font=phrases_font)
        test_width = test_bbox[2] - test_bbox[0]

        if test_width <= max_width:
            current_line = test_line
        else:
            if current_line:
                phrases_lines.append(current_line)
            current_line = phrase

    if current_line:
        phrases_lines.append(current_line)

    # Draw each line of phrases
    for i, line in enumerate(phrases_lines):
        line_bbox = draw.textbbox((0, 0), line, font=phrases_font)
        line_width = line_bbox[2] - line_bbox[0]
        line_x = (image_width - line_width) // 2
        line_y = phrases_y + (i * 20)
        draw.text((line_x, line_y), line, fill="black", font=phrases_font)

    # Save to BytesIO
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()

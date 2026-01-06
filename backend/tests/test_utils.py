import pytest
from osmosmjerka.utils import export_to_docx


def test_export_to_docx_valid_input(tmp_path):
    category = "Animals"
    grid = [["C", "A", "T"], ["D", "O", "G"], ["F", "O", "X"]]
    phrases = [
        {"phrase": "cat", "translation": "kot"},
        {"phrase": "dog", "translation": "pies"},
        {"phrase": "fox", "translation": "lis"},
    ]
    docx_bytes = export_to_docx(category, grid, phrases)
    assert isinstance(docx_bytes, bytes)
    # Save to file and check it's a valid docx
    docx_file = tmp_path / "test.docx"
    docx_file.write_bytes(docx_bytes)
    # Try to open with python-docx
    from docx import Document

    doc = Document(str(docx_file))
    assert doc.paragraphs[0].text == category.upper()
    assert phrases[0]["phrase"].upper() in doc.paragraphs[-1].text


def test_export_to_docx_empty_category():
    grid = [["A"]]
    phrases = [{"phrase": "a", "translation": "A"}]
    with pytest.raises(ValueError):
        export_to_docx("", grid, phrases)


def test_export_to_docx_empty_grid():
    category = "Test"
    phrases = [{"phrase": "a", "translation": "A"}]
    with pytest.raises(ValueError):
        export_to_docx(category, [], phrases)


def test_export_to_docx_empty_phrases():
    category = "Test"
    grid = [["A"]]
    with pytest.raises(ValueError):
        export_to_docx(category, grid, [])


def test_export_to_docx_single_letter_grid(tmp_path):
    category = "Single"
    grid = [["Z"]]
    phrases = [{"phrase": "z", "translation": "Z"}]
    docx_bytes = export_to_docx(category, grid, phrases)
    assert isinstance(docx_bytes, bytes)
    docx_file = tmp_path / "single.docx"
    docx_file.write_bytes(docx_bytes)
    from docx import Document

    doc = Document(str(docx_file))
    assert doc.tables[0].cell(0, 0).text == "Z"


def test_export_to_docx_phrases_with_special_characters(tmp_path):
    category = "Special"
    grid = [["Ä", "Ö"], ["Ü", "ß"]]
    phrases = [{"phrase": "äöüß", "translation": "special"}]
    docx_bytes = export_to_docx(category, grid, phrases)
    docx_file = tmp_path / "special.docx"
    docx_file.write_bytes(docx_bytes)
    from docx import Document

    doc = Document(str(docx_file))
    assert "Ä" in doc.tables[0].cell(0, 0).text
    assert "Ö" in doc.tables[0].cell(0, 1).text
    assert "Ü" in doc.tables[0].cell(1, 0).text
    assert "ß" in doc.tables[0].cell(1, 1).text


def test_export_to_png_valid_input(tmp_path):
    from osmosmjerka.utils import export_to_png

    category = "Animals"
    grid = [["C", "A", "T"], ["D", "O", "G"], ["F", "O", "X"]]
    phrases = [
        {"phrase": "cat", "translation": "kot"},
        {"phrase": "dog", "translation": "pies"},
        {"phrase": "fox", "translation": "lis"},
    ]
    png_bytes = export_to_png(category, grid, phrases)
    assert isinstance(png_bytes, bytes)
    png_file = tmp_path / "test.png"
    png_file.write_bytes(png_bytes)
    from PIL import Image

    img = Image.open(str(png_file))
    assert img.format == "PNG"


def test_export_to_png_empty_phrases():
    from osmosmjerka.utils import export_to_png

    category = "Test"
    grid = [["A"]]
    with pytest.raises(ValueError):
        export_to_png(category, grid, [])

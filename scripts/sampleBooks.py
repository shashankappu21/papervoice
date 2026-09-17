"""
Typesets public-domain books as PDFs, for screenshots and for testing.

    python scripts/sampleBooks.py

Every book in a store screenshot is on public display, so it cannot be
somebody's copyrighted novel -- the cover, the text and the title would all be
in a marketing image implying an association that does not exist. These are
Project Gutenberg texts, public domain in the United States; Gutenberg's own
terms say to check your own country, and term varies by jurisdiction.

Gutenberg no longer publishes PDFs, only plain text, so this typesets them.
That turns out to be useful rather than merely necessary: the app draws a
book's cover from its first page, so a title page designed to look like one
gives the library something to show.

They also make better test documents than a real book does, because the page
count, the chapter structure and the length are all known.

Needs `pip install reportlab`.
"""
import os
import re
import urllib.request

from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A5
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, NextPageTemplate,
                                PageBreak, PageTemplate, Paragraph, Spacer)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'design', 'books')
CACHE = os.path.join(ROOT, 'design', '.gutenberg')

# Chosen to look like a real shelf: different eras, different lengths, and
# titles a stranger recognises without any of them being in copyright.
BOOKS = [
    (1342, 'Pride and Prejudice', 'Jane Austen', 1813),
    (11, "Alice's Adventures in Wonderland", 'Lewis Carroll', 1865),
    (1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 1892),
    (84, 'Frankenstein', 'Mary Shelley', 1818),
    (2701, 'Moby Dick', 'Herman Melville', 1851),
]

# Enough for a believable page count and a contents page, without spending
# minutes extracting a whole novel every time a screenshot is retaken.
CHAPTERS = 6


def fetch(book_id):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f'{book_id}.txt')
    if not os.path.exists(path):
        url = f'https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt'
        with urllib.request.urlopen(url, timeout=60) as response:
            raw = response.read().decode('utf-8', 'replace')
        with open(path, 'w', encoding='utf-8') as handle:
            handle.write(raw)
    with open(path, encoding='utf-8') as handle:
        return handle.read()


def body_of(text):
    """Gutenberg wraps each book in a licence header and footer."""
    start = re.search(r'\*\*\* *START OF TH[EIS]+ PROJECT GUTENBERG[^\n]*\n', text)
    end = re.search(r'\*\*\* *END OF TH[EIS]+ PROJECT GUTENBERG', text)
    return text[start.end() if start else 0:end.start() if end else len(text)]


# How short a "chapter" has to be before it is really a contents entry.
#
# Every one of these books lists its chapters at the front in the same form as
# the headings themselves, so a naive split returns the table of contents first
# and the book afterwards -- which produced five seven-page PDFs, each holding
# nothing but a contents page cut into pieces.
TOC_ENTRY = 2000


def chapters(text):
    """
    Split on chapter headings, keeping each heading with its text.

    Deliberately loose about the word: these books head their chapters as
    CHAPTER, Chapter, ADVENTURE or LETTER, and a pattern that misses one simply
    yields fewer, longer chapters -- which still reads as a book.
    """
    parts = re.split(
        r'\n\s*((?:(?:CHAPTER|Chapter|ADVENTURE|Adventure|LETTER|Letter)'
        r'\s+[IVXLC\d]+\.?[^\n]*'
        # Sherlock Holmes heads its stories with a bare numeral and a title,
        # "I.     A Scandal in Bohemia", with no word in front of it at all.
        r'|[IVXLC]{1,6}\.\s{2,}[A-Z][^\n]*))\n',
        text)
    if len(parts) < 3:
        return [('Chapter I', text[:60000])]

    out = []
    for index in range(1, len(parts) - 1, 2):
        body = parts[index + 1]
        if len(body) < TOC_ENTRY:
            continue
        out.append((parts[index].strip(), body))
    return out or [('Chapter I', text[:60000])]


def paragraphs(chunk):
    for block in re.split(r'\n\s*\n', chunk):
        cleaned = ' '.join(block.split())
        if len(cleaned) > 1:
            yield cleaned


def build(book_id, title, author, year):
    text = body_of(fetch(book_id))

    name = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')
    path = os.path.join(OUT, f'{name}.pdf')

    doc = BaseDocTemplate(path, pagesize=A5,
                          leftMargin=18 * mm, rightMargin=18 * mm,
                          topMargin=20 * mm, bottomMargin=18 * mm,
                          title=title, author=author)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='page')
    doc.addPageTemplates([PageTemplate(id='cover', frames=[frame]),
                          PageTemplate(id='body', frames=[frame])])

    big = ParagraphStyle('big', fontName='Times-Bold', fontSize=30, leading=36,
                         alignment=TA_CENTER, spaceAfter=18)
    byline = ParagraphStyle('byline', fontName='Times-Italic', fontSize=15,
                            leading=20, alignment=TA_CENTER, spaceAfter=10)
    small = ParagraphStyle('small', fontName='Times-Roman', fontSize=10,
                           leading=14, alignment=TA_CENTER)
    heading = ParagraphStyle('heading', fontName='Times-Bold', fontSize=15,
                             leading=20, spaceBefore=12, spaceAfter=12)
    prose = ParagraphStyle('prose', fontName='Times-Roman', fontSize=11,
                           leading=16.5, alignment=TA_JUSTIFY, firstLineIndent=12,
                           spaceAfter=3)

    # The title page doubles as the cover, since that is the page the app draws.
    story = [Spacer(1, 42 * mm), Paragraph(title, big), Paragraph(author, byline),
             Spacer(1, 10 * mm), Paragraph(str(year), small),
             Spacer(1, 30 * mm),
             Paragraph('Project Gutenberg &mdash; public domain', small),
             NextPageTemplate('body'), PageBreak()]

    for name_of, chunk in chapters(text)[:CHAPTERS]:
        story.append(Paragraph(name_of, heading))
        for para in list(paragraphs(chunk))[:90]:
            story.append(Paragraph(para.replace('&', '&amp;')
                                   .replace('<', '&lt;'), prose))
        story.append(PageBreak())

    doc.build(story)
    return path, os.path.getsize(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    for book_id, title, author, year in BOOKS:
        try:
            path, size = build(book_id, title, author, year)
            print(f'  {size / 1024:7.0f} KB  {os.path.basename(path)}')
        except Exception as cause:            # noqa: BLE001 - one bad book is not fatal
            print(f'  FAILED {title}: {cause}')
    print(f'\nIn {OUT}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

"""
Builds the images papervoice.app serves, from real screen captures.

    npm run site:assets

The landing page shows the app itself rather than a stock phone, so these come
straight out of design/raw/ -- the same captures the Play listing uses -- and
are only resized and re-encoded here.

    design/raw/02-reader.png        -->  site/img/reader.webp
    design/raw/promo-lyra-card.png  -->  site/img/voices.webp
    design/raw/01-library.png       -->  site/img/library.webp
    assets/icon.png                 -->  site/favicon.png, apple-touch-icon.png
                                         site/og.png  (the social card)

WebP because these are photographs of a screen in all but name: at width 640
and quality 82 each one lands around 40KB, against 300KB as PNG, and the page
should open on a phone on a train.

Needs Pillow. Shares its fonts with storeAssets.py, which fetches them, and
brings down their OFL notices, which have to ship beside the font files.
"""
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from storeAssets import SANS, SERIF, font  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'design', 'raw')
SITE = os.path.join(ROOT, 'site')
IMG = os.path.join(SITE, 'img')

# The app's paper theme, so the page and the screenshots share one background.
PAPER = (250, 247, 240)
SURFACE = (242, 236, 224)
INK = (28, 25, 23)
MUTED = (87, 83, 78)

# Displayed around 320px wide, so 640 covers a 2x screen and nothing more.
WIDTH = 640

SHOTS = [
    ('02-reader.png', 'reader.webp'),
    ('promo-lyra-card.png', 'voices.webp'),
    ('01-library.png', 'library.webp'),
]


def shot(source, name):
    path = os.path.join(RAW, source)
    if not os.path.exists(path):
        return f'  missing  {source}'
    image = Image.open(path).convert('RGB')
    height = round(image.height * WIDTH / image.width)
    out = os.path.join(IMG, name)
    image.resize((WIDTH, height), Image.LANCZOS).save(out, 'WEBP', quality=82, method=6)
    return f'  {os.path.getsize(out) / 1024:5.0f} KB  img/{name}  {WIDTH}x{height}'


def icons():
    src = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
    flat = Image.new('RGB', src.size, PAPER)
    flat.paste(src, (0, 0), src)
    written = []
    for size, name in ((64, 'favicon.png'), (180, 'apple-touch-icon.png')):
        out = os.path.join(SITE, name)
        flat.resize((size, size), Image.LANCZOS).save(out, 'PNG', optimize=True)
        written.append(f'  {os.path.getsize(out) / 1024:5.0f} KB  {name}')
    return written


def social():
    """
    1200x630, for the card that appears when the link is shared.

    Text stays clear of the edges because the services that render this crop it
    differently, and some round the corners.
    """
    canvas = Image.new('RGB', (1200, 630), PAPER)
    draw = ImageDraw.Draw(canvas)

    reader = os.path.join(RAW, '02-reader.png')
    if os.path.exists(reader):
        phone = Image.open(reader).convert('RGB')
        width = 300
        phone = phone.resize((width, round(phone.height * width / phone.width)), Image.LANCZOS)
        mask = Image.new('L', phone.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([(0, 0), phone.size], 26, fill=255)
        frame = Image.new('RGB', (width + 14, phone.height + 14), (17, 17, 19))
        rounded = Image.new('L', frame.size, 0)
        ImageDraw.Draw(rounded).rounded_rectangle([(0, 0), frame.size], 33, fill=255)
        frame.paste(phone, (7, 7), mask)
        canvas.paste(frame, (820, 96), rounded)

    draw.text((84, 150), 'Papervoice', font=font(SERIF, 86), fill=INK)
    draw.text((88, 274), 'Finally get through the PDFs', font=font(SANS, 34), fill=MUTED)
    draw.text((88, 322), 'you keep meaning to read.', font=font(SANS, 34), fill=MUTED)

    draw.rounded_rectangle([(88, 410), (452, 468)], 29, fill=SURFACE)
    draw.text((116, 424), 'Free  ·  Offline  ·  Open source', font=font(SANS, 25), fill=MUTED)

    out = os.path.join(SITE, 'og.png')
    canvas.save(out, 'PNG', optimize=True)
    return f'  {os.path.getsize(out) / 1024:5.0f} KB  og.png  1200x630'


def fonts():
    """
    The two brand faces, subset to the characters this site uses.

    Self-hosted rather than fetched from a font CDN: a page whose subject is
    that nothing about you is collected should not make every reader call on a
    third party before a word of it appears. Subsetting is what makes that
    affordable -- the pair comes to about 32KB, keeping their weight axes.
    """
    try:
        from fontTools import subset
        from fontTools.varLib.instancer import instantiateVariableFont
    except ImportError:
        return ['  skipped fonts: pip install fonttools brotli']

    text = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            ' .,:;!?\'’“”—–-()[]{}/@&%#*+=<>|~^$'
            '·×→✓')

    out = os.path.join(SITE, 'fonts')
    os.makedirs(out, exist_ok=True)
    written = []

    # The licence travels with the font. Both are under the SIL Open Font
    # License, which requires the notice to accompany the font software --
    # and subsetting it, as this does, is still redistributing it.
    for folder in ('playfairdisplay', 'jost'):
        notice = os.path.join(out, 'OFL-%s.txt' % folder)
        if os.path.exists(notice):
            continue
        url = 'https://github.com/google/fonts/raw/main/ofl/%s/OFL.txt' % folder
        try:
            with urllib.request.urlopen(url, timeout=60) as response:
                with open(notice, 'wb') as handle:
                    handle.write(response.read())
            written.append('  fetched  fonts/OFL-%s.txt' % folder)
        except Exception as cause:            # noqa: BLE001 - say so, do not fail
            written.append('  FAILED to fetch the OFL for %s: %s' % (folder, cause))

    for name, target, low, high in (('PlayfairDisplay.ttf', 'playfair.woff2', 400, 700),
                                    ('Jost.ttf', 'jost.woff2', 300, 700)):
        source = os.path.join(ROOT, 'design', 'fonts', name)
        if not os.path.exists(source):
            written.append(f'  missing  {name} -- run `npm run assets` first, which fetches it')
            continue
        options = subset.Options()
        options.flavor = 'woff2'
        options.layout_features = ['kern', 'liga', 'calt']
        options.desubroutinize = True
        face = subset.load_font(source, options)
        cut = subset.Subsetter(options=options)
        cut.populate(text=text)
        cut.subset(face)
        face = instantiateVariableFont(face, {'wght': (low, None, high)})
        path = os.path.join(out, target)
        subset.save_font(face, path, options)
        written.append(f'  {os.path.getsize(path) / 1024:5.0f} KB  fonts/{target}')
    return written


def main():
    os.makedirs(IMG, exist_ok=True)
    for source, name in SHOTS:
        print(shot(source, name))
    for line in icons():
        print(line)
    for line in fonts():
        print(line)
    print(social())
    print(f'\nIn {SITE}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

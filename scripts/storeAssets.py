"""
Builds the Play Store images from raw screenshots.

    npm run assets
    SHOT=1 npm run assets     just the one, while adjusting the design

Takes whatever is in design/raw/ -- screen captures straight off a phone,
1080x2400 -- and frames each one with a headline, at the size Play wants.

    design/raw/01-library.png   -->  design/store/screenshot-1.png
    assets/icon.png             -->  design/store/icon-512.png
                                     design/store/feature-graphic.png

Two things about the output are not taste, they are Play's rules:

  * 1080x1920. The long side may not be more than twice the short side, which
    is why the obvious choice -- keeping the phone's own 1080x2400 -- is
    rejected at 2.22:1.
  * 24-bit PNG, no alpha.

Needs Pillow. The captions live in SHOTS below; rename a raw file and it is
matched by its leading number.
"""
import os
import re
import urllib.request

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'design', 'raw')
OUT = os.path.join(ROOT, 'design', 'store')

CANVAS = (1080, 1920)

# Warm paper rather than the app's dark surface: every screenshot is in the
# paper theme, and a near-black frame around a cream screen fought with them.
BG_TOP = (238, 230, 210)
BG_BOTTOM = (228, 218, 193)
INK = (26, 22, 18)
MUTED = (95, 84, 70)
BEZEL = (17, 17, 19)

# Playfair Display for the headline, Jost for the caps line under it, both at
# weight 500.
#
# Not a guess: the set these replace was made by a design tool, and each
# candidate was rendered at the same width as a crop of that output and
# compared. Playfair matched the headline's contrast and width; Jost matched
# the caps line, where Poppins and Century Gothic were both too light and too
# wide. Both are variable fonts, hence the weight axis.
FONTS = os.path.join(ROOT, 'design', 'fonts')
GOOGLE = 'https://github.com/google/fonts/raw/main/ofl'
SERIF = ('PlayfairDisplay.ttf', GOOGLE + '/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf')
SANS = ('Jost.ttf', GOOGLE + '/jost/Jost%5Bwght%5D.ttf')
WEIGHT = 500

# What each screenshot says. Order is the order Play shows them, and the first
# is the one most people see, so it carries the main claim.
#
# A newline in a headline is a deliberate break: left to itself, "Your Books,
# Read Aloud" strands "Aloud" on a line of its own.
SHOTS = {
    1: ('Your Books,\nRead Aloud',
        'Listen to PDFs like audiobooks, offline and private'),
    2: ('Follow Along\nas You Listen',
        'Highlighted sentences sync perfectly with natural voices'),
    3: ('Fifteen\nNatural Voices',
        'Download once, listen offline forever'),
    4: ('Complete Privacy,\nNo Compromise',
        'Everything stays on your phone. No accounts, no ads, no tracking'),
    5: ('Jump to\nAny Chapter',
        'Navigate PDFs with extracted, clickable contents'),
    6: ('Read at\nYour Own Pace',
        # 0.5 and 3 are RATE_LIMITS in src/player/rate.ts. The 0.8 and 2.5 on
        # screen are the preset chips, not the range.
        # A multiplication sign, not the letter x, which upper-cases to "3X".
        'From 0.5× to 3×, find your perfect pace'),
}


def font(spec, size, weight=WEIGHT):
    """
    One of the two faces, fetched on first use.

    They are not committed -- a megabyte of font in a repository that already
    ships a 30MB app is not worth it -- so the first run downloads them and
    every run after finds them on disk.
    """
    name, url = spec
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        os.makedirs(FONTS, exist_ok=True)
        print(f'  fetching {name}')
        with urllib.request.urlopen(url, timeout=60) as response:
            with open(path, 'wb') as handle:
                handle.write(response.read())

    face = ImageFont.truetype(path, size)
    try:
        face.set_variation_by_axes([weight])
    except OSError:
        # A static build of the same font has no axes to set, and is fine.
        pass
    return face


def width_of(draw, text, fnt, tracking=0):
    if tracking == 0:
        box = draw.textbbox((0, 0), text, font=fnt)
        return box[2] - box[0]
    return sum(draw.textlength(ch, font=fnt) + tracking for ch in text) - tracking


def draw_tracked(draw, x, y, text, fnt, fill, tracking):
    """Pillow has no letter-spacing, and the caps line needs it to breathe."""
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking


def wrap(draw, text, fnt, limit, tracking=0):
    """Word wrap to a pixel width, honouring any newline already in the text."""
    lines = []
    for paragraph in text.split('\n'):
        line = ''
        for word in paragraph.split():
            trial = (line + ' ' + word).strip()
            if line and width_of(draw, trial, fnt, tracking) > limit:
                lines.append(line)
                line = word
            else:
                line = trial
        lines.append(line)
    return lines


def background():
    """A vertical wash, so the field is not a flat rectangle of one colour."""
    canvas = Image.new('RGB', CANVAS, BG_TOP)
    draw = ImageDraw.Draw(canvas)
    for y in range(CANVAS[1]):
        t = y / CANVAS[1]
        draw.line([(0, y), (CANVAS[0], y)],
                  fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)))
    return canvas


def device(shot, width):
    """
    The phone, whole.

    The earlier version scaled the screen up and let it run off the bottom of
    the frame. That reads as a phone in use, but it costs you the bottom of
    every screen -- on the speed sheet it cut off the presets, which were the
    one thing the caption was talking about.
    """
    ratio = shot.height / shot.width
    inner = shot.resize((width, round(width * ratio)), Image.LANCZOS)

    bezel = max(8, round(width * 0.024))
    radius_in = round(width * 0.085)
    outer = (inner.width + bezel * 2, inner.height + bezel * 2)

    mask = Image.new('L', inner.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), inner.size], radius_in, fill=255)

    frame = Image.new('RGBA', outer, (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle([(0, 0), outer], radius_in + bezel,
                                            fill=BEZEL + (255,))
    frame.paste(inner, (bezel, bezel), mask)
    return frame


def shadow(size, radius, blur, alpha):
    layer = Image.new('RGBA', (size[0] + blur * 4, size[1] + blur * 4), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        [(blur * 2, blur * 2), (blur * 2 + size[0], blur * 2 + size[1])],
        radius, fill=(70, 56, 38, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def compose(shot_path, title, subtitle, out_path):
    canvas = background()
    draw = ImageDraw.Draw(canvas)

    # 96px and 32px reproduce the proportions measured off the reference set,
    # where "Your Books, Read" ran 802px across a 1080px canvas.
    head = font(SERIF, 96)
    sub = font(SANS, 32)
    tracking = 2.8

    top = 84
    for line in wrap(draw, title, head, 980):
        draw.text(((CANVAS[0] - width_of(draw, line, head)) / 2, top),
                  line, font=head, fill=INK)
        top += 112

    top += 20
    for line in wrap(draw, subtitle.upper(), sub, 940, tracking):
        draw_tracked(draw, (CANVAS[0] - width_of(draw, line, sub, tracking)) / 2,
                     top, line, sub, MUTED, tracking)
        top += 48

    # Whatever vertical space the words leave over belongs to the phone, and
    # the phone's width follows from that -- not the other way round, or the
    # bottom of the screen gets cut off again.
    gap = 56
    bottom_margin = 66
    available = CANVAS[1] - (top + gap) - bottom_margin

    shot = Image.open(shot_path).convert('RGB')
    bezel_ratio = 0.024
    width = min(round(CANVAS[0] * 0.66),
                round(available / (shot.height / shot.width + 2 * bezel_ratio)))

    frame = device(shot, width)
    x = (CANVAS[0] - frame.width) // 2
    y = top + gap + max(0, (available - frame.height) // 2)

    glow = shadow(frame.size, round(width * 0.11), 26, 66)
    canvas.paste(glow, (x - 52, y - 44), glow)
    canvas.paste(frame, (x, y), frame)

    canvas.save(out_path, 'PNG', optimize=True)
    return out_path


def icon():
    """512x512, no transparency: Play rejects an icon with an alpha channel."""
    src = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
    flat = Image.new('RGB', src.size, BG_TOP)
    flat.paste(src, (0, 0), src)
    out = os.path.join(OUT, 'icon-512.png')
    flat.resize((512, 512), Image.LANCZOS).save(out, 'PNG', optimize=True)
    return out


def feature_graphic():
    """
    1024x500, shown at the top of the listing.

    Play crops and overlays this unpredictably across surfaces, so everything
    that matters stays near the middle and there is no text near the edges.
    """
    canvas = Image.new('RGB', (1024, 500), BG_TOP)
    draw = ImageDraw.Draw(canvas)

    src = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
    mark = src.resize((148, 148), Image.LANCZOS)
    rounded = Image.new('L', mark.size, 0)
    ImageDraw.Draw(rounded).rounded_rectangle([(0, 0), mark.size], 34, fill=255)
    canvas.paste(mark, (110, 96), rounded)

    draw.text((110, 268), 'Papervoice', font=font(SERIF, 66), fill=INK)
    draw_tracked(draw, 112, 362, 'YOUR BOOKS, READ ALOUD. OFFLINE.',
                 font(SANS, 25), MUTED, 2.6)

    out = os.path.join(OUT, 'feature-graphic.png')
    canvas.save(out, 'PNG', optimize=True)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    print(icon())
    print(feature_graphic())

    if not os.path.isdir(RAW):
        print('\nNo ' + RAW + ' -- put raw screen captures there, named 01-*.png ...')
        return 0

    only = os.environ.get('SHOT')
    made = 0
    for name in sorted(os.listdir(RAW)):
        match = re.match(r'0?(\d+)', name)
        if not match or not name.lower().endswith(('.png', '.jpg')):
            continue
        number = int(match.group(1))
        if only and str(number) != only:
            continue
        title, subtitle = SHOTS.get(number, ('Papervoice', ''))
        out = os.path.join(OUT, 'screenshot-' + str(number) + '.png')
        print(compose(os.path.join(RAW, name), title, subtitle, out))
        made += 1

    if made == 0:
        print('\nNothing in ' + RAW + ' matched. Files need to start with a number.')
    else:
        print('\n' + str(made) + ' screenshots, 1080x1920. Play shows the first 8.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

"""
Builds the Play Store and website images from raw screenshots.

    npm run assets

Takes whatever is in design/raw/ -- screen captures straight off a phone or
emulator, 1080x2400 -- and produces the sizes Play insists on, each with the
app's own colours and a line of text saying what is being looked at.

Done as a script rather than by hand in an image editor because there are
three sets of these (Play, the website, social cards), they all change
together whenever the app does, and doing it by hand means they drift.

    design/raw/01-library.png      -->  design/store/screenshot-1.png
    assets/icon.png                -->  design/store/icon-512.png
                                        design/store/feature-graphic.png

Needs Pillow. The captions live in SHOTS below; rename a raw file and it is
matched by its leading number.
"""
import os
import re
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'design', 'raw')
OUT = os.path.join(ROOT, 'design', 'store')

# The app's own palette, so the store page and the app agree.
BG = (13, 13, 15)
SURFACE = (28, 28, 32)
TEXT = (242, 242, 244)
MUTED = (160, 160, 170)
ACCENT = (139, 124, 246)

# Play wants 1080x1920 minimum for phone screenshots; a 9:16 frame leaves
# room above the device for a caption without cropping the screen itself.
CANVAS = (1080, 1920)

FONT_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
FONT_REG = 'C:/Windows/Fonts/segoeui.ttf'

# What each screenshot is saying. Order is the order Play shows them, and the
# first is the one most people see, so it carries the main claim.
SHOTS = {
    1: ('Your books, read aloud', 'Import a PDF and listen'),
    2: ('Follow along as it reads', 'The spoken sentence is highlighted'),
    3: ('Fifteen voices, on your phone', 'Downloaded once, then offline'),
    4: ('Nothing leaves your device', 'No account, no ads, no tracking'),
    5: ('Jump to any chapter', "Read out of the PDF's own contents"),
    6: ('Read at your own pace', 'From half speed to three times'),
}


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def rounded(image, radius):
    """A phone screenshot with square corners looks like a bug, not a phone."""
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), image.size], radius, fill=255)
    out = image.copy()
    out.putalpha(mask)
    return out


def glow(size, radius, colour, blur):
    """A soft halo behind the device, so it is not a rectangle on a flat field."""
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([(0, 0), size], radius, fill=colour)
    return layer.filter(ImageFilter.GaussianBlur(blur))


def centred(draw, y, text, fnt, fill, width):
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text(((width - (box[2] - box[0])) / 2, y), text, font=fnt, fill=fill)
    return box[3] - box[1]


def compose(shot_path, title, subtitle, out_path):
    canvas = Image.new('RGB', CANVAS, BG)
    draw = ImageDraw.Draw(canvas)

    # A wash of colour at the top, so the caption is not floating on black.
    wash = Image.new('RGBA', (CANVAS[0], 700), (0, 0, 0, 0))
    ImageDraw.Draw(wash).ellipse([(-200, -520), (CANVAS[0] + 200, 480)],
                                 fill=ACCENT + (46,))
    canvas.paste(Image.alpha_composite(
        canvas.crop((0, 0, CANVAS[0], 700)).convert('RGBA'), wash.filter(
            ImageFilter.GaussianBlur(90))).convert('RGB'), (0, 0))

    y = 96
    y += centred(draw, y, title, font(FONT_BOLD, 62), TEXT, CANVAS[0]) + 44
    centred(draw, y, subtitle, font(FONT_REG, 34), MUTED, CANVAS[0])

    # The device, scaled to leave the caption alone and bleed off the bottom --
    # a screen that runs off the edge reads as a real phone in use, where one
    # floating in the middle reads as a picture of a phone.
    shot = Image.open(shot_path).convert('RGB')
    target_w = int(CANVAS[0] * 0.78)
    target_h = int(shot.height * (target_w / shot.width))
    shot = shot.resize((target_w, target_h), Image.LANCZOS)

    x = (CANVAS[0] - target_w) // 2
    top = 330

    canvas.paste(glow((target_w + 120, target_h + 120), 80, ACCENT + (70,), 60),
                 (x - 60, top - 40),
                 glow((target_w + 120, target_h + 120), 80, ACCENT + (70,), 60))

    framed = rounded(shot, 34)
    border = Image.new('RGBA', (target_w + 8, target_h + 8), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [(0, 0), (target_w + 8, target_h + 8)], 38, fill=SURFACE + (255,))
    canvas.paste(border, (x - 4, top - 4), border)
    canvas.paste(framed, (x, top), framed)

    canvas.save(out_path, 'PNG', optimize=True)
    return out_path


def icon():
    """512x512, no transparency: Play rejects an icon with an alpha channel."""
    src = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
    flat = Image.new('RGB', src.size, BG)
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
    canvas = Image.new('RGB', (1024, 500), BG)
    draw = ImageDraw.Draw(canvas)

    wash = Image.new('RGBA', (1024, 500), (0, 0, 0, 0))
    ImageDraw.Draw(wash).ellipse([(420, -260), (1180, 420)], fill=ACCENT + (60,))
    canvas.paste(Image.alpha_composite(canvas.convert('RGBA'),
                                       wash.filter(ImageFilter.GaussianBlur(110))
                                       ).convert('RGB'), (0, 0))

    # Rounded, because a square one reads as a logo pasted on rather than as
    # the app's icon. Android draws it rounded everywhere else.
    src = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')
    mark = rounded(src.resize((150, 150), Image.LANCZOS), 34)
    canvas.paste(mark, (92, 96), mark)

    draw.text((92, 274), 'Papervoice', font=font(FONT_BOLD, 66), fill=TEXT)
    draw.text((92, 358), 'Your books, read aloud. Offline.',
              font=font(FONT_REG, 32), fill=MUTED)

    out = os.path.join(OUT, 'feature-graphic.png')
    canvas.save(out, 'PNG', optimize=True)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    print(icon())
    print(feature_graphic())

    if not os.path.isdir(RAW):
        print(f'\nNo {RAW} -- put raw screen captures there, named 01-*.png, 02-*.png ...')
        return 0

    made = 0
    for name in sorted(os.listdir(RAW)):
        match = re.match(r'0?(\d+)', name)
        if not match or not name.lower().endswith(('.png', '.jpg')):
            continue
        number = int(match.group(1))
        title, subtitle = SHOTS.get(number, ('Papervoice', ''))
        out = os.path.join(OUT, f'screenshot-{number}.png')
        print(compose(os.path.join(RAW, name), title, subtitle, out))
        made += 1

    if made == 0:
        print(f'\nNothing in {RAW} matched. Files need to start with a number.')
    else:
        print(f'\n{made} screenshots. Play needs at least 2, and shows the first 8.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

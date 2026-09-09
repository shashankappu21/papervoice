"""
Cuts the Papervoice mark out of the generated artwork and writes every size.

The artwork it starts from has a hard seam down the middle where the
background changes colour -- an artefact of how it was generated, and one that
shows on a home screen. Only the white mark is kept; the background is laid
down cleanly here, in the app's own accent, so the icon and the app are the
same colour.

    python scripts/makeIcon.py
"""
from PIL import Image, ImageDraw

SOURCE = 'design/logo.png'
INDIGO = (79, 70, 229, 255)  # #4F46E5, the accent used throughout the app
CLEAR = (0, 0, 0, 0)

# Anything below this in every channel is background; above it is the mark.
# The mark is white and the background is a saturated blue, so the smallest
# channel separates them cleanly where luminance would not: blue is bright.
FLOOR, CEILING = 40, 225


def cut_out_mark():
    """The white mark alone, cropped tight, as a transparent image."""
    source = Image.open(SOURCE).convert('RGB')
    width, height = source.size
    pixels = source.load()

    mark = Image.new('RGBA', (width, height), CLEAR)
    out = mark.load()

    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            # Soft, so the edges the artwork was drawn with are kept rather
            # than replaced with a staircase.
            level = (min(r, g, b) - FLOOR) / (CEILING - FLOOR)
            alpha = max(0, min(1, level))
            if alpha > 0:
                out[x, y] = (255, 255, 255, int(alpha * 255))

    return mark.crop(mark.getbbox())


def place(mark, size, background, fraction):
    """The mark centred on a square, taking `fraction` of the width."""
    canvas = Image.new('RGBA', (size, size), background)

    target = int(size * fraction)
    scale = target / max(mark.size)
    resized = mark.resize(
        (max(1, round(mark.width * scale)), max(1, round(mark.height * scale))),
        Image.LANCZOS,
    )

    canvas.alpha_composite(
        resized,
        ((size - resized.width) // 2, (size - resized.height) // 2),
    )
    return canvas


def tinted(image, colour):
    """The same shape in another colour, for the splash on a pale background."""
    solid = Image.new('RGBA', image.size, colour)
    solid.putalpha(image.split()[3])
    return solid


mark = cut_out_mark()
print(f'mark cut out at {mark.size}')

# The launcher icon: the mark on its colour, filling the tile.
place(mark, 1024, INDIGO, 0.62).save('assets/icon.png')

# Adaptive icons are cropped to whatever shape the launcher likes, so the mark
# sits well inside the safe circle and the colour is a layer of its own.
place(mark, 1024, CLEAR, 0.44).save('assets/android-icon-foreground.png')
Image.new('RGBA', (1024, 1024), INDIGO).save('assets/android-icon-background.png')
# Themed icons are tinted by the system, so this one is only a silhouette.
place(mark, 1024, CLEAR, 0.44).save('assets/android-icon-monochrome.png')

place(tinted(mark, INDIGO), 512, CLEAR, 0.60).save('assets/splash-icon.png')
place(mark, 64, INDIGO, 0.62).save('assets/favicon.png')

print('wrote icon, adaptive foreground/background/monochrome, splash and favicon')

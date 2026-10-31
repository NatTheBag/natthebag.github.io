#!/usr/bin/env python3
"""
Generates printable name tags in the site's Windows XP theme.

    python3 tools/make-nametag.py

Outputs, at the site root:

    nametag-portrait.png    900 x 1200  (3" x 4" at 300 dpi)
    nametag-landscape.png   1200 x 900  (4" x 3" at 300 dpi)

3" x 4" is the standard badge-insert size — it drops straight into
the usual conference nametag holder (Avery 5384 inserts, 74459 /
74461 holders) with no trimming. The files carry 300 dpi metadata,
so print them at 100% / "actual size" rather than "fit to page".

The tag carries the name, the website and a QR code to it, and
nothing else. Artwork comes from xp-wallpaper.js via the sibling
make-social-images.py, so the two stay in step.

Needs:  python3 -m pip install pillow segno
"""

import importlib.util
import os

import segno
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# reuse the field, sprites and palettes from the preview-image script
_spec = importlib.util.spec_from_file_location(
    'xp_art', os.path.join(HERE, 'make-social-images.py'))
art = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(art)

DPI = 300
NAME = 'Han Lu'
SITE = 'natthebag.github.io'
URL = 'https://natthebag.github.io/'

BLUE = (0, 88, 238)
BLUE_HI = (75, 148, 255)
FACE = (236, 233, 216)
INK = (13, 59, 122)
GREY = (77, 77, 71)
FIELDLINE = (127, 157, 185)


def font(size, bold=True):
    return ImageFont.truetype(art.TAHOMA_BOLD if bold else art.TAHOMA, size)


def text_stack(d, cx, cy, lines, gap):
    """Draw lines centred on (cx, cy) as one block. Each line is
    (text, font, colour). Measuring the real ink box rather than the
    font metrics keeps the group optically centred."""
    boxes = [d.textbbox((0, 0), t, font=f) for t, f, _ in lines]
    heights = [b[3] - b[1] for b in boxes]
    total = sum(heights) + gap * (len(lines) - 1)

    y = cy - total / 2
    for (text, f, colour), (l, t, r, b), h in zip(lines, boxes, heights):
        d.text((cx - (r - l) / 2 - l, y - t), text, font=f, fill=colour)
        y += h + gap


def qr_image(px_target):
    """QR for the site, snapped to whole pixels per module so it stays
    crisp, with the 4-module quiet zone scanners need."""
    qr = segno.make(URL, error='q')
    matrix = [[bool(m) for m in row] for row in qr.matrix]
    n = len(matrix)
    quiet = 4
    total = n + quiet * 2
    module = max(1, px_target // total)
    size = total * module

    img = Image.new('RGB', (size, size), (255, 255, 255))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(matrix):
        for x, on in enumerate(row):
            if on:
                px, py = (x + quiet) * module, (y + quiet) * module
                d.rectangle([px, py, px + module - 1, py + module - 1],
                            fill=(0, 0, 0))
    return img, qr.version


def field_backdrop(W, H, pixel=5):
    """The wallpaper hill, with flowers and one sitting bunny."""
    import random
    rng = random.Random(art.SEED)
    aw, ah = W // pixel, H // pixel
    f = art.build_field(aw, ah)

    for _ in range(int(aw / 6)):
        depth = 0.10 + rng.random() * 0.85
        shape = art.FLOWER_SHAPES[rng.randrange(len(art.FLOWER_SHAPES))]
        scale = 1 if depth < 0.55 else 2
        x = rng.random() * aw
        art.draw_sprite(f, shape, int(x),
                        int(art.ground_y(x, depth, aw, ah)) - len(shape) * scale,
                        scale, art.BLOOMS[rng.randrange(len(art.BLOOMS))],
                        flip=rng.random() < 0.5)
    return f, aw, ah, pixel


def bunny_below(field, aw, ah, fx, scale, clear_art):
    """Sit the bunny in the strip of desktop showing under the window,
    far enough down that the window edge does not clip its ears.
    clear_art is the window's bottom edge in field pixels."""
    rows = art.BUNNIES['SIT']
    x = fx * aw
    feet = clear_art + 3 + len(rows) * scale
    feet = min(feet, ah - 1)
    d = ImageDraw.Draw(field)
    sx, sy = int(x) + 2 * scale, int(feet) - scale
    under = field.getpixel((min(aw - 1, sx), min(ah - 1, sy)))
    d.rectangle([sx, sy, sx + 8 * scale, sy + scale - 1],
                fill=tuple(int(v * 0.72) for v in under))
    art.draw_sprite(field, rows, int(x), int(feet) - len(rows) * scale,
                    scale, art.COATS[0])


def window_chrome(d, box, bar_h, icon):
    """XP window: blue frame, title bar with the bunny icon and the three
    buttons. No title text — the tag carries no words but the name,
    the site and the code."""
    x0, y0, x1, y1 = box
    d.rectangle([x0 - 4, y0, x1 + 4, y1 + 4], fill=BLUE)
    d.rectangle([x0 - 4, y0, x1 + 4, y0 + 3], fill=BLUE_HI)
    d.rectangle([x0, y0 + bar_h, x1, y1], fill=FACE)

    ic = bar_h - 26
    d.rectangle([x0 + 14, y0 + 13, x0 + 14 + ic, y0 + 13 + ic], fill=(255, 255, 255))
    d._image.paste(icon.resize((ic - 4, ic - 4), Image.NEAREST), (x0 + 16, y0 + 15))

    bw = int(bar_h * 0.46)
    gap = int(bw * 1.24)
    for i, colour in enumerate([(47, 123, 239), (47, 123, 239), (199, 80, 80)]):
        bx = x1 - 16 - bw - (2 - i) * gap
        by = y0 + (bar_h - bw) // 2
        r = max(3, bw // 7)
        d.rounded_rectangle([bx, by, bx + bw, by + bw], radius=r,
                            fill=colour, outline=(255, 255, 255),
                            width=max(2, bw // 14))
        cx, cy = bx + bw // 2, by + bw // 2
        u = max(2, bw // 8)
        if i == 0:
            d.rectangle([cx - 2 * u, cy + u, cx + 2 * u, cy + 2 * u], fill=(255,) * 3)
        elif i == 1:
            d.rectangle([cx - 2 * u, cy - 2 * u, cx + 2 * u, cy + 2 * u],
                        outline=(255,) * 3, width=max(2, u))
            d.rectangle([cx - 2 * u, cy - 2 * u, cx + 2 * u, cy - u], fill=(255,) * 3)
        else:
            d.line([cx - 2 * u, cy - 2 * u, cx + 2 * u, cy + 2 * u],
                   fill=(255,) * 3, width=max(3, u))
            d.line([cx + 2 * u, cy - 2 * u, cx - 2 * u, cy + 2 * u],
                   fill=(255,) * 3, width=max(3, u))


def sunken(d, box, pad=6):
    """White inset panel, the XP field look — also gives the QR the pale
    margin it needs to scan."""
    x0, y0, x1, y1 = box
    d.rectangle([x0 - pad, y0 - pad, x1 + pad, y1 + pad], fill=(255, 255, 255),
                outline=FIELDLINE, width=3)


def build(portrait):
    W, H = (900, 1200) if portrait else (1200, 900)

    if portrait:
        wx0, wy0, wx1, wy1 = 46, 44, W - 46, 1004
        bar, qr_px = 82, 470
    else:
        wx0, wy0, wx1, wy1 = 46, 44, W - 46, 748
        bar, qr_px = 78, 470

    field, aw, ah, pixel = field_backdrop(W, H)
    # the bunny sits in the strip of desktop left showing below the window
    bunny_below(field, aw, ah, 0.72, 2, (wy1 + 4) / pixel)
    img = field.resize((W, H), Image.NEAREST)
    d = ImageDraw.Draw(img)
    d._image = img

    window_chrome(d, (wx0, wy0, wx1, wy1), bar, art.bunny_tile(64))

    qr, version = qr_image(qr_px)

    top = wy0 + bar
    lines = [(NAME, font(150 if portrait else 128), INK),
             (SITE, font(52 if portrait else 44), GREY)]
    pad = 6 + 3          # sunken() panel padding + its border

    if portrait:
        # name over site over code, the whole column centred in the body
        qw, qh = qr.size
        text_h = sum(d.textbbox((0, 0), t, font=f)[3] -
                     d.textbbox((0, 0), t, font=f)[1] for t, f, _ in lines) + 26
        block = text_h + 52 + qh + pad * 2
        y = top + ((wy1 - top) - block) / 2

        text_stack(d, (wx0 + wx1) / 2, y + text_h / 2, lines, 26)

        qx = wx0 + (wx1 - wx0 - qw) // 2
        qy = int(y + text_h + 52 + pad)
        sunken(d, (qx, qy, qx + qw, qy + qh))
        img.paste(qr, (qx, qy))
    else:
        # code on the right, name and site centred against it on the left
        qw, qh = qr.size
        qx = wx1 - qw - 62
        qy = top + ((wy1 - top) - qh) // 2
        sunken(d, (qx, qy, qx + qw, qy + qh))
        img.paste(qr, (qx, qy))

        text_stack(d, (wx0 + qx - pad) / 2, qy + qh / 2, lines, 34)

    out = os.path.join(ROOT, 'nametag-%s.png' % ('portrait' if portrait else 'landscape'))
    img.save(out, dpi=(DPI, DPI), optimize=True)
    inches = (W / DPI, H / DPI)
    print(f'{os.path.basename(out)}  {W}x{H}px  '
          f'{inches[0]:.0f}" x {inches[1]:.0f}"  QR v{version}')


if __name__ == '__main__':
    build(portrait=True)
    build(portrait=False)

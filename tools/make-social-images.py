#!/usr/bin/env python3
"""
Generates the link-preview image and the favicons.

    python3 tools/make-social-images.py

Outputs, all at the site root:

    social-preview.png    1200x630, used by og:image / twitter:image
    favicon.ico           16 / 32 / 48 px bunny
    favicon-32.png        same bunny, for browsers that prefer a PNG
    apple-touch-icon.png  180x180, for iOS home-screen bookmarks

The sprites, palettes and flower shapes are READ OUT OF xp-wallpaper.js
rather than duplicated here, so editing a bunny pose or adding a flower
colour there and re-running this keeps everything in step.

Needs Pillow:  python3 -m pip install pillow
"""

import math
import os
import random
import re

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALLPAPER = os.path.join(ROOT, 'xp-wallpaper.js')

FONT_DIR = '/System/Library/Fonts/Supplemental'
TAHOMA = os.path.join(FONT_DIR, 'Tahoma.ttf')
TAHOMA_BOLD = os.path.join(FONT_DIR, 'Tahoma Bold.ttf')

SEED = 7          # fixed so the picture is reproducible


# ── pull the artwork out of the wallpaper script ────────────────────

def _js():
    with open(WALLPAPER, encoding='utf-8') as fh:
        return fh.read()


def sprite(src, name):
    block = re.search(r'const %s = \[(.*?)\];' % name, src, re.S).group(1)
    return re.findall(r"'([^']*)'", block)


def sprite_list(src, name):
    block = re.search(r'const %s = \[(.*?)\n  \];' % name, src, re.S).group(1)
    return [re.findall(r"'([^']*)'", grp) for grp in re.findall(r'\[(.*?)\]', block, re.S)]


def palette_list(src, name):
    block = re.search(r'const %s = \[(.*?)\n  \];' % name, src, re.S).group(1)
    out = []
    for grp in re.findall(r'\{([^}]*)\}', block):
        out.append(dict(re.findall(r"(\w+):\s*'([^']+)'", grp)))
    return out


def rgb_ramp(src, name):
    block = re.search(r'const %s = \[(.*?)\];' % name, src, re.S).group(1)
    return [tuple(int(v) for v in m)
            for m in re.findall(r'\[\s*(\d+),\s*(\d+),\s*(\d+)\s*\]', block)]


JS = _js()

SKY = rgb_ramp(JS, 'SKY')
GRASS = rgb_ramp(JS, 'GRASS')
COATS = palette_list(JS, 'COATS')
BLOOMS = palette_list(JS, 'BLOOMS')
FLOWER_SHAPES = sprite_list(JS, 'FLOWER_SHAPES')
CLOUDS = sprite_list(JS, 'CLOUDS')
CLOUD_COAT = dict(re.findall(r"(\w+):\s*'([^']+)'",
                             re.search(r'const CLOUD_COAT = \{([^}]*)\}', JS).group(1)))

BUNNIES = {n: sprite(JS, 'BUNNY_' + n)
           for n in ('CROUCH', 'PUSH', 'STRETCH', 'LAND', 'SIT')}

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def expand(colors, steps):
    out = []
    for i in range(steps):
        p = (i / (steps - 1)) * (len(colors) - 1)
        a = int(p)
        b = min(len(colors) - 1, a + 1)
        f = p - a
        out.append(tuple(round(colors[a][k] + (colors[b][k] - colors[a][k]) * f)
                         for k in range(3)))
    return out


SKY_BANDS = expand(SKY, 20)
GRASS_BANDS = expand(GRASS, 16)


def ramp(bands, p, x, y):
    p = max(0.0, min(1.0, p)) * (len(bands) - 1)
    i = min(len(bands) - 1, int(p))
    frac = p - i
    if frac > BAYER[y & 3][x & 3] / 16 and i + 1 < len(bands):
        i += 1
    return bands[i]


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ── the field ───────────────────────────────────────────────────────

def hill_y(x, W, H):
    """Same curve as the live wallpaper, sitting a little higher so the
    grass fills more of a wide, short image."""
    t = x / W
    d = t - 0.26
    bump = math.exp(-(d * d) / (2 * 0.30 * 0.30))
    return H * 0.46 - H * 0.15 * bump - H * 0.012 * math.sin(t * 6.2 + 1.1)


def draw_sprite(img, rows, px, py, scale, coat, flip=False):
    d = ImageDraw.Draw(img)
    cols = len(rows[0])
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch == '.' or ch not in coat:
                continue
            cx = (cols - 1 - c) if flip else c
            x0, y0 = px + cx * scale, py + r * scale
            d.rectangle([x0, y0, x0 + scale - 1, y0 + scale - 1],
                        fill=hex_rgb(coat[ch]))


def build_field(W, H):
    """Sky, hill and grass at one pixel per art unit."""
    img = Image.new('RGB', (W, H))
    px = img.load()
    for x in range(W):
        hy = hill_y(x, W, H)
        for y in range(H):
            if y < hy:
                px[x, y] = ramp(SKY_BANDS, y / hy, x, y)
            else:
                depth = (y - hy) / max(1, H - hy)
                px[x, y] = (GRASS_BANDS[0] if (y - hy) < 2
                            else ramp(GRASS_BANDS, depth * 1.1, x, y))
    return img


def ground_y(x, depth, W, H):
    hy = hill_y(max(0, min(W - 1, x)), W, H)
    return hy + depth * (H - hy)


# ── the preview image ───────────────────────────────────────────────

NAME = 'Han Lu'
SITE = 'natthebag.github.io'
TAGLINE = 'Engineering, robotics, and building things that exist in the physical world.'


def social_preview(out_path, W=1200, H=630, PIXEL=6):
    rng = random.Random(SEED)
    aw, ah = W // PIXEL, H // PIXEL

    field = build_field(aw, ah)

    # clouds, kept up in the clear sky
    for i in range(4):
        kind = rng.randrange(len(CLOUDS))
        sp = CLOUDS[kind]
        draw_sprite(field, sp,
                    rng.randrange(2, aw - len(sp[0]) * 2),
                    3 + rng.randrange(max(4, int(ah * 0.14))),
                    2 if kind == 0 else 1, CLOUD_COAT)

    # flowers across the whole field
    for _ in range(int(aw / 5)):
        depth = 0.05 + rng.random() * 0.92
        shape = FLOWER_SHAPES[rng.randrange(len(FLOWER_SHAPES))]
        scale = 1 if depth < 0.5 else 2
        x = rng.random() * aw
        draw_sprite(field, shape, int(x),
                    int(ground_y(x, depth, aw, ah)) - len(shape) * scale,
                    scale, BLOOMS[rng.randrange(len(BLOOMS))],
                    flip=rng.random() < 0.5)

    # One sitting bunny. The hop poses are built to be read in motion —
    # frozen in a still they just look like a rabbit falling over — so
    # the card uses the idle pose only. Placed by hand in the clear band
    # under the window, in the white coat so it reads against the grass.
    # (x fraction, depth, facing, scale)
    fx, depth, facing, scale = 0.53, 0.86, 1, 2

    rows = BUNNIES['SIT']
    x = fx * aw
    feet = ground_y(x, depth, aw, ah)

    d = ImageDraw.Draw(field)
    sx, sy = int(x) + 2 * scale, int(feet) - scale
    under = field.getpixel((min(aw - 1, sx), min(ah - 1, sy)))
    d.rectangle([sx, sy, sx + 8 * scale, sy + scale - 1],
                fill=tuple(int(v * 0.72) for v in under))

    draw_sprite(field, rows, int(x), int(feet) - len(rows) * scale,
                scale, COATS[0], flip=facing < 0)

    img = field.resize((W, H), Image.NEAREST)
    d = ImageDraw.Draw(img)

    # ── the window on top, drawn at full resolution so text stays sharp
    wx0, wy0, wx1, wy1 = 150, 122, 1050, 436
    bar_h, status_h = 52, 34

    d.rectangle([wx0 - 3, wy0, wx1 + 3, wy1 + 3], fill=(0, 88, 238))
    d.rectangle([wx0 - 3, wy0, wx1 + 3, wy0 + bar_h], fill=(0, 88, 238))
    d.rectangle([wx0 - 3, wy0, wx1 + 3, wy0 + 2], fill=(75, 148, 255))
    d.rectangle([wx0, wy0 + bar_h, wx1, wy1], fill=(236, 233, 216))

    f_title = ImageFont.truetype(TAHOMA_BOLD, 23)
    f_name = ImageFont.truetype(TAHOMA_BOLD, 92)
    f_site = ImageFont.truetype(TAHOMA_BOLD, 31)
    f_tag = ImageFont.truetype(TAHOMA, 22)
    f_small = ImageFont.truetype(TAHOMA, 19)

    d.rectangle([wx0 + 12, wy0 + 16, wx0 + 33, wy0 + 37], fill=(255, 255, 255))
    d.text((wx0 + 17, wy0 + 17), 'e', font=f_title, fill=(0, 88, 238))
    d.text((wx0 + 45, wy0 + 15), f'{NAME} — Microsoft Internet Explorer',
           font=f_title, fill=(255, 255, 255))

    # the three title-bar buttons. The glyphs are drawn as shapes rather
    # than typed, since Tahoma has no box or heavy-cross character.
    for i, colour in enumerate([(47, 123, 239), (47, 123, 239), (199, 80, 80)]):
        bx = wx1 - 24 - (2 - i) * 34
        by = wy0 + 12
        d.rounded_rectangle([bx, by, bx + 28, by + 28], radius=4,
                            fill=colour, outline=(255, 255, 255), width=2)
        cx, cy, w = bx + 14, by + 14, 255
        if i == 0:                                    # minimise
            d.rectangle([cx - 6, cy + 5, cx + 5, cy + 7], fill=(w, w, w))
        elif i == 1:                                  # maximise
            d.rectangle([cx - 6, cy - 6, cx + 6, cy + 6], outline=(w, w, w), width=2)
            d.rectangle([cx - 6, cy - 6, cx + 6, cy - 3], fill=(w, w, w))
        else:                                         # close
            d.line([cx - 5, cy - 5, cx + 5, cy + 5], fill=(w, w, w), width=3)
            d.line([cx + 5, cy - 5, cx - 5, cy + 5], fill=(w, w, w), width=3)

    # window body
    tx = wx0 + 54
    d.text((tx, wy0 + bar_h + 42), NAME, font=f_name, fill=(13, 59, 122))
    d.text((tx + 4, wy0 + bar_h + 154), SITE, font=f_site, fill=(77, 77, 71))
    d.text((tx + 4, wy0 + bar_h + 196), TAGLINE, font=f_tag, fill=(77, 77, 71))

    # window status bar
    sy = wy1 - status_h
    d.rectangle([wx0, sy, wx1, wy1], fill=(236, 233, 216))
    d.line([wx0, sy, wx1, sy], fill=(255, 255, 255))
    d.text((wx0 + 14, sy + 8), 'Done', font=f_small, fill=(77, 77, 71))
    d.text((wx1 - 100, sy + 8), 'Internet', font=f_small, fill=(77, 77, 71))

    # ── taskbar along the bottom
    tb = 46
    d.rectangle([0, H - tb, W, H], fill=(36, 94, 219))
    d.rectangle([0, H - tb, W, H - tb + 3], fill=(74, 134, 247))
    d.rounded_rectangle([-12, H - tb + 3, 150, H], radius=12, fill=(60, 153, 60))

    fx0, fy0, sq = 22, H - tb + 13, 9
    for i, colour in enumerate([(214, 59, 47), (76, 166, 76),
                                (43, 110, 214), (224, 164, 0)]):
        d.rectangle([fx0 + (i % 2) * (sq + 2), fy0 + (i // 2) * (sq + 2),
                     fx0 + (i % 2) * (sq + 2) + sq, fy0 + (i // 2) * (sq + 2) + sq],
                    fill=colour)
    d.text((fx0 + 30, H - tb + 12),
           'start', font=ImageFont.truetype(TAHOMA_BOLD, 24), fill=(255, 255, 255))

    img.save(out_path, optimize=True)
    print(f'{os.path.relpath(out_path, ROOT)}  {img.size[0]}x{img.size[1]}')


# ── the favicon ─────────────────────────────────────────────────────

def bunny_tile(size, pose='SIT'):
    """The bunny on a grass-green tile, scaled by whole pixels so it
    stays crisp at favicon sizes."""
    rows = BUNNIES[pose]

    # trim the sprite to its ink
    cols = len(rows[0])
    xs = [c for r in rows for c, ch in enumerate(r) if ch != '.']
    ys = [i for i, r in enumerate(rows) if any(ch != '.' for ch in r)]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    trimmed = [r[x0:x1 + 1] for r in rows[y0:y1 + 1]]
    tw, th = len(trimmed[0]), len(trimmed)

    scale = max(1, min((size - 2) // tw, (size - 2) // th))
    img = Image.new('RGB', (size, size), GRASS[2])
    draw_sprite(img, trimmed,
                (size - tw * scale) // 2, (size - th * scale) // 2,
                scale, COATS[0])
    return img


def favicons():
    sizes = [16, 32, 48]
    tiles = {s: bunny_tile(s) for s in sizes}

    ico = os.path.join(ROOT, 'favicon.ico')
    # append_images matters here: left to itself Pillow builds the small
    # sizes by smoothly downscaling the 48px one, which turns crisp pixel
    # art into mush. These are each drawn at their own size instead.
    tiles[48].save(ico, format='ICO',
                   sizes=[(s, s) for s in sizes],
                   append_images=[tiles[16], tiles[32]])
    print('favicon.ico  ' + ', '.join(f'{s}x{s}' for s in sizes))

    tiles[32].save(os.path.join(ROOT, 'favicon-32.png'), optimize=True)
    print('favicon-32.png  32x32')

    # iOS wants a bigger, opaque square
    bunny_tile(180).save(os.path.join(ROOT, 'apple-touch-icon.png'), optimize=True)
    print('apple-touch-icon.png  180x180')


if __name__ == '__main__':
    social_preview(os.path.join(ROOT, 'social-preview.png'))
    favicons()

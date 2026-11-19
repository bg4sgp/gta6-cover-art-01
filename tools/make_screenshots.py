#!/usr/bin/env python3
"""Renders the files in screenshots/ for the Vice Panels entry.

The app itself draws its covers on a browser canvas (app/src/). This tool
paints the same designs with Pillow -- the same panel tables, scene
geometry, colours and lettering rules, re-implemented from app/src/panels.js,
app/src/cover.js and app/src/lettering.js -- so the entry's screenshots can
be produced on a machine with no browser to shoot them in. The four scenes
come from shots.json: three exported covers (landscape, portrait, square)
and the editor with the sample photos loaded.

Run:  python3 tools/make_screenshots.py
"""

import json
import math
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "app" / "samples"
OUT_DIR = ROOT / "screenshots"
FONT_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
PAPER = (247, 241, 227)


def hx(colour):
    colour = colour.lstrip("#")
    return tuple(int(colour[i:i + 2], 16) for i in (0, 2, 4))


class SeededRandom:
    """The same linear congruential generator the app uses (app/src/panels.js)."""

    def __init__(self, seed):
        self.state = (seed & 0xFFFFFFFF) or 1

    def __call__(self):
        self.state = (self.state * 1103515245 + 12345) & 0x7FFFFFFF
        return self.state / 0x7FFFFFFF


def vgrad(w, h, stops):
    """A vertical linear gradient image; stops are (offset, (r, g, b))."""
    offsets = np.array([s[0] for s in stops])
    colours = np.array([s[1] for s in stops], dtype=float)
    t = np.linspace(0, 1, max(h, 1))
    img = np.zeros((h, w, 3), dtype=np.uint8)
    for channel in range(3):
        img[:, :, channel] = np.interp(t, offsets, colours[:, channel]).astype(np.uint8)[:, None]
    return Image.fromarray(img, "RGB")


def vgrad_rgba(w, h, stops):
    """A vertical gradient of (r, g, b, a) stops, as an RGBA image."""
    offsets = np.array([s[0] for s in stops])
    colours = np.array([s[1] for s in stops], dtype=float)
    t = np.linspace(0, 1, max(h, 1))
    img = np.zeros((h, w, 4), dtype=np.uint8)
    for channel in range(4):
        img[:, :, channel] = np.interp(t, offsets, colours[:, channel]).astype(np.uint8)[:, None]
    return Image.fromarray(img, "RGBA")


def radial_glow(w, h, cx, cy, radius, rgb, max_alpha):
    """An RGBA disc of colour fading from max_alpha at the centre to 0 at radius."""
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    alpha = np.clip(1 - dist / max(radius, 1), 0, 1) * max_alpha
    img = np.zeros((h, w, 4), dtype=np.uint8)
    img[:, :, 0], img[:, :, 1], img[:, :, 2] = rgb
    img[:, :, 3] = alpha.astype(np.uint8)
    return Image.fromarray(img, "RGBA")


def quad(p0, p1, p2, n=14):
    """Points along a quadratic bezier from p0 (control p1) to p2."""
    points = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        points.append((x, y))
    return points


def palm_tree(draw, bx, by, height, lean, colour):
    """A palm silhouette rooted at (bx, by): curved trunk, eight fronds, coconuts."""
    top = (bx + lean * height, by - height)
    trunk = quad((bx, by), (bx + lean * height * 0.3, by - height * 0.6), top, 16)
    draw.line(trunk, fill=colour, width=max(2, round(height * 0.05)), joint="curve")
    for i in range(8):
        angle = math.pi * (1.06 + (i / 7) * 0.88)
        reach = height * (0.36 + (i % 3) * 0.045)
        dir_x, dir_y = math.cos(angle), math.sin(angle)
        end = (top[0] + dir_x * reach, top[1] + dir_y * reach * 0.55 + reach * 0.3)
        ctrl = (top[0] + dir_x * reach * 0.5, top[1] + dir_y * reach * 0.62)
        draw.line(quad(top, ctrl, end, 12), fill=colour,
                  width=max(2, round(height * 0.034)), joint="curve")
    for side in (-1, 1):
        r = height * 0.032
        cx, cy = top[0] + side * height * 0.035, top[1] + height * 0.03
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour)


def sports_car(draw, cx, gy, width, colour):
    """A low sports car in profile, nose right, ground line gy."""
    h = width * 0.26

    def rel(dx, dy):
        return (cx + dx * width, gy + dy * h)

    outline = [rel(-0.5, 0), rel(-0.48, -0.42)]
    outline += quad(rel(-0.48, -0.42), rel(-0.3, -0.58), rel(-0.16, -0.6))
    outline += quad(rel(-0.16, -0.6), rel(-0.05, -0.84), rel(0.12, -0.82))
    outline += quad(rel(0.12, -0.82), rel(0.3, -0.78), rel(0.38, -0.55))
    outline += quad(rel(0.38, -0.55), rel(0.5, -0.48), rel(0.5, 0))
    draw.polygon(outline, fill=colour)
    glass = quad(rel(-0.12, -0.62), rel(-0.02, -0.79), rel(0.1, -0.77))
    glass += quad(rel(0.1, -0.77), rel(0.19, -0.75), rel(0.24, -0.6))
    draw.polygon(glass, fill=(110, 165, 205))
    for wx in (cx - width * 0.3, cx + width * 0.3):
        r = width * 0.085
        draw.ellipse([wx - r, gy - r, wx + r, gy + r], fill=(10, 10, 18))


def plane_shape(draw, px, py, s, colour):
    """A small airliner silhouette flying right, centred near (px, py)."""

    def rel(dx, dy):
        return (px + dx * s, py + dy * s)

    outline = [rel(0.52, 0), rel(0.3, -0.07), rel(-0.28, -0.09), rel(-0.44, -0.3),
               rel(-0.52, -0.28), rel(-0.46, -0.02), rel(-0.3, 0.04), rel(-0.04, 0.32),
               rel(0.07, 0.3), rel(0.1, 0.05), rel(0.32, 0.04)]
    draw.polygon(outline, fill=colour)


def sailboat(draw, cx, wy, width, colour):
    """Hull, mast and two sails, floating on water line wy."""
    h = width * 0.9
    draw.polygon([(cx - width * 0.5, wy), (cx + width * 0.5, wy),
                  (cx + width * 0.32, wy + h * 0.16), (cx - width * 0.32, wy + h * 0.16)],
                 fill=colour)
    draw.polygon([(cx, wy), (cx, wy - h), (cx + width * 0.34, wy - h * 0.08)], fill=colour)
    draw.polygon([(cx - width * 0.05, wy - h * 0.06), (cx - width * 0.05, wy - h * 0.78),
                  (cx - width * 0.36, wy - h * 0.06)], fill=colour)


# ---------------------------------------------------------------- scenes
# Each painter returns an RGB image of exactly (w, h), the panel's size,
# mirroring the canvas painter of the same name in app/src/panels.js.

def paint_beach(w, h):
    img = vgrad(w, h, [(0, hx("#ffcf4d")), (0.45, hx("#ff7e47")),
                       (0.68, hx("#e83e8c")), (1, hx("#5b2a86"))])
    sun = (w * 0.66, h * 0.6)
    img.paste(radial_glow(w, h, *sun, h * 0.5, (255, 244, 190), 230), (0, 0),
              radial_glow(w, h, *sun, h * 0.5, (255, 244, 190), 230))
    draw = ImageDraw.Draw(img)
    draw.ellipse([sun[0] - h * 0.17, sun[1] - h * 0.17, sun[0] + h * 0.17, sun[1] + h * 0.17],
                 fill=(255, 243, 176))
    sea_top = int(h * 0.64)
    sea = vgrad(w, h - sea_top, [(0, hx("#c94f7c")), (1, hx("#2b1055"))])
    img.paste(sea, (0, sea_top))
    draw = ImageDraw.Draw(img, "RGBA")
    rand = SeededRandom(7)
    for _ in range(16):
        ry = sea_top + rand() * (h * 0.3)
        rw = w * (0.05 + rand() * 0.16) * (1 - (ry - sea_top) / h)
        draw.rectangle([sun[0] - rw / 2 + (rand() - 0.5) * w * 0.08, ry,
                        sun[0] + rw / 2 + (rand() - 0.5) * w * 0.08, ry + max(1.5, h * 0.012)],
                       fill=(255, 220, 150, 140))
    draw.rectangle([0, h * 0.93, w, h], fill=(34, 16, 46))
    palm_tree(draw, w * 0.1, h * 1.0, h * 0.52, 0.16, (22, 10, 36))
    palm_tree(draw, w * 0.94, h * 1.0, h * 0.42, -0.2, (22, 10, 36))
    return img


def paint_neon(w, h):
    img = vgrad(w, h, [(0, hx("#050914")), (0.6, hx("#1b0f38")), (1, hx("#33105c"))])
    draw = ImageDraw.Draw(img)
    rand = SeededRandom(21)
    for i in range(6):
        bw = w * (0.1 + rand() * 0.1)
        bh = h * (0.35 + rand() * 0.4)
        bx = (i / 6) * w + rand() * w * 0.04
        draw.rectangle([bx, h * 0.72 - bh, bx + bw, h * 0.72], fill=(13, 18, 48))
        for _ in range(8):
            if rand() > 0.5:
                dx = bx + rand() * bw * 0.8
                dy = h * 0.72 - bh + rand() * bh * 0.85
                draw.rectangle([dx, dy, dx + w * 0.016, dy + w * 0.016],
                               fill=(255, 214, 106))
    glow_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)

    def sign(sx, sy, sw, sh, colour):
        glow_draw.rounded_rectangle([sx, sy, sx + sw, sy + sh], radius=h * 0.03,
                                    outline=colour + (255,), width=max(2, round(h * 0.014)))

    sign(w * 0.08, h * 0.12, w * 0.3, h * 0.16, (34, 211, 238))
    sign(w * 0.6, h * 0.2, w * 0.32, h * 0.13, (255, 79, 216))
    sign(w * 0.16, h * 0.36, w * 0.2, h * 0.11, (255, 210, 63))
    img.paste(Image.alpha_composite(img.convert("RGBA"),
                                    glow_layer.filter(ImageFilter.GaussianBlur(h * 0.02))).convert("RGB"),
              (0, 0))
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow_layer).convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    street_top = h * 0.72
    draw.polygon([(0, h), (w * 0.32, street_top), (w * 0.68, street_top), (w, h)],
                 fill=(18, 11, 42))
    draw.rectangle([w * 0.2, street_top + h * 0.04, w * 0.22, street_top + h * 0.24],
                   fill=(34, 211, 238, 90))
    draw.rectangle([w * 0.78, street_top + h * 0.04, w * 0.8, street_top + h * 0.24],
                   fill=(255, 79, 216, 90))
    sports_car(draw, w * 0.5, h * 0.99, w * 0.4, (5, 5, 13))
    light_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    light_draw = ImageDraw.Draw(light_layer)
    light_draw.rectangle([w * 0.36, h * 0.93, w * 0.43, h * 0.95], fill=(255, 42, 60, 255))
    light_draw.rectangle([w * 0.57, h * 0.93, w * 0.64, h * 0.95], fill=(255, 42, 60, 255))
    img.paste(Image.alpha_composite(img.convert("RGBA"),
                                    light_layer.filter(ImageFilter.GaussianBlur(h * 0.03))).convert("RGB"),
              (0, 0))
    return img


def paint_pier(w, h):
    img = vgrad(w, h, [(0, hx("#ffe8c2")), (0.42, hx("#ffb37b")), (1, hx("#ff8c69"))])
    draw = ImageDraw.Draw(img)
    draw.ellipse([w * 0.22 - h * 0.1, h * 0.24 - h * 0.1, w * 0.22 + h * 0.1, h * 0.24 + h * 0.1],
                 fill=(255, 246, 218))
    sea_top = int(h * 0.44)
    sea = vgrad(w, h - sea_top, [(0, hx("#15919b")), (1, hx("#074f66"))])
    img.paste(sea, (0, sea_top))
    draw = ImageDraw.Draw(img, "RGBA")
    rand = SeededRandom(4)
    for _ in range(12):
        ly = sea_top + rand() * h * 0.5
        lx = rand() * w * 0.85
        draw.line([(lx, ly), (lx + w * (0.04 + rand() * 0.08), ly)],
                  fill=(255, 255, 255, 90), width=max(1, round(h * 0.008)))
    sailboat(draw, w * 0.7, sea_top + h * 0.2, w * 0.24, (18, 48, 62))
    deck_y = h * 0.62
    draw.rectangle([0, deck_y, w, deck_y + h * 0.045], fill=(46, 26, 18))
    for i in range(7):
        draw.rectangle([w * (0.05 + i * 0.15), deck_y,
                        w * (0.05 + i * 0.15) + w * 0.025, deck_y + h * 0.3],
                       fill=(46, 26, 18))
    draw.line([(0, deck_y - h * 0.09), (w, deck_y - h * 0.09)], fill=(46, 26, 18),
              width=max(2, round(h * 0.014)))
    for i in range(9):
        px = w * (0.03 + i * 0.12)
        draw.line([(px, deck_y - h * 0.09), (px, deck_y)], fill=(46, 26, 18),
                  width=max(2, round(h * 0.014)))
    for bx, by, s in [(0.55, 0.16, 0.05), (0.66, 0.11, 0.04), (0.48, 0.1, 0.035)]:
        for cx in (w * bx - w * s, w * bx + w * s):
            draw.arc([cx - w * s, h * by - w * s * 0.6, cx + w * s, h * by + w * s * 0.6],
                     start=200, end=340, fill=(20, 20, 30, 205),
                     width=max(2, round(h * 0.01)))
    return img


def paint_skyline(w, h):
    img = vgrad(w, h, [(0, hx("#241047")), (0.55, hx("#7c2d6e")), (1, hx("#ff7e47"))])
    draw = ImageDraw.Draw(img)
    draw.ellipse([w * 0.8 - h * 0.09, h * 0.62 - h * 0.09, w * 0.8 + h * 0.09, h * 0.62 + h * 0.09],
                 fill=(255, 217, 160))
    plane_shape(draw, w * 0.3, h * 0.16, w * 0.2, (28, 11, 51))
    draw.line([(w * 0.05, h * 0.2), (w * 0.18, h * 0.18)], fill=(255, 255, 255),
              width=max(1, round(h * 0.008)))
    rand = SeededRandom(11)
    bx = -w * 0.02
    while bx < w:
        bw = w * (0.09 + rand() * 0.12)
        bh = h * (0.3 + rand() * 0.42)
        draw.rectangle([bx, h - bh, bx + bw, h], fill=(18, 8, 31))
        cols = max(1, int(bw / (w * 0.035)))
        rows = max(2, int(bh / (h * 0.07)))
        for c in range(cols):
            for r in range(rows):
                if rand() > 0.55:
                    draw.rectangle([bx + w * 0.012 + c * w * 0.035, h - bh + h * 0.03 + r * h * 0.07,
                                    bx + w * 0.028 + c * w * 0.035, h - bh + h * 0.062 + r * h * 0.07],
                                   fill=(255, 215, 106))
        bx += bw + w * 0.015
    return img


def paint_palms(w, h):
    img = vgrad(w, h, [(0, hx("#fff3a0")), (0.5, hx("#ff9a5a")), (1, hx("#ff5e7a"))])
    glow = radial_glow(w, h, w / 2, h * 0.52, h * 0.7, (255, 250, 210), 200)
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse([w / 2 - h * 0.2, h * 0.52 - h * 0.2, w / 2 + h * 0.2, h * 0.52 + h * 0.2],
                 fill=(255, 248, 214))
    draw.rectangle([0, h * 0.8, w, h * 0.845], fill=(146, 44, 92, 190))
    palm_tree(draw, w * 0.04, h * 1.02, h * 0.66, 0.3, (13, 40, 28))
    palm_tree(draw, w * 0.99, h * 1.02, h * 0.58, -0.34, (13, 40, 28))
    palm_tree(draw, w * 0.2, h * 1.02, h * 0.4, 0.12, (18, 53, 36))
    return img


def paint_speedway(w, h):
    img = vgrad(w, h, [(0, hx("#2b1055")), (0.55, hx("#7c2d6e")), (1, hx("#b83a6e"))])
    draw = ImageDraw.Draw(img, "RGBA")
    rand = SeededRandom(3)
    bx = 0.0
    while bx < w:
        bw = w * (0.06 + rand() * 0.08)
        bh = h * (0.1 + rand() * 0.14)
        draw.rectangle([bx, h * 0.56 - bh, bx + bw, h * 0.56], fill=(23, 11, 48))
        bx += bw + w * 0.01
    vx, vy = w / 2, h * 0.56
    draw.polygon([(-w * 0.1, h), (vx - w * 0.06, vy), (vx + w * 0.06, vy), (w * 1.1, h)],
                 fill=(23, 18, 31))
    draw.line([(-w * 0.1, h), (vx - w * 0.06, vy)], fill=(255, 79, 216),
              width=max(2, round(h * 0.012)))
    draw.line([(w * 1.1, h), (vx + w * 0.06, vy)], fill=(255, 79, 216),
              width=max(2, round(h * 0.012)))
    for i in range(4):
        t = i / 4
        dy = vy + (h * 0.44) * (t * t + 0.12)
        dw = w * 0.012 * (0.4 + t * 2.2)
        draw.rectangle([vx - dw / 2, dy, vx + dw / 2, dy + h * 0.05 * (0.3 + t)],
                       fill=(255, 210, 63))
    for _ in range(7):
        sy = h * (0.6 + rand() * 0.3)
        draw.rectangle([rand() * w * 0.2, sy, rand() * w * 0.2 + w * 0.2, sy + max(1, h * 0.006)],
                       fill=(255, 255, 255, 40))
        sx = w * (0.65 + rand() * 0.2)
        draw.rectangle([sx, sy, sx + w * (0.1 + rand() * 0.2), sy + max(1, h * 0.006)],
                       fill=(255, 255, 255, 40))
    sports_car(draw, w / 2, h * 0.99, w * 0.56, (7, 7, 15))
    lamp = radial_glow(w, h, w * 0.76, h * 0.9, w * 0.09, (255, 244, 190), 215)
    img.paste(Image.alpha_composite(img.convert("RGBA"), lamp).convert("RGB"), (0, 0))
    return img


PAINTERS = {
    "beach": paint_beach,
    "neon": paint_neon,
    "pier": paint_pier,
    "skyline": paint_skyline,
    "palms": paint_palms,
    "speedway": paint_speedway,
}


# ---------------------------------------------------------------- layout

LAYOUTS = {
    "classic": {
        "tall": [[0, 0, 0.625, 0.5], [0.625, 0, 0.375, 0.25], [0.625, 0.25, 0.375, 0.25],
                 [0, 0.5, 0.34, 0.27], [0.34, 0.5, 0.33, 0.27], [0.67, 0.5, 0.33, 0.27],
                 [0, 0.77, 1, 0.23]],
        "wide": [[0, 0, 0.46, 1], [0.46, 0, 0.27, 0.52], [0.73, 0, 0.27, 0.52],
                 [0.46, 0.52, 0.27, 0.48], [0.73, 0.52, 0.27, 0.48]],
    },
    "hero": {
        "tall": [[0, 0, 0.56, 1], [0.56, 0, 0.44, 0.34], [0.56, 0.34, 0.44, 0.33],
                 [0.56, 0.67, 0.44, 0.33]],
        "wide": [[0, 0, 0.58, 1], [0.58, 0, 0.42, 0.5], [0.58, 0.5, 0.42, 0.5]],
    },
    "strips": {
        "tall": [[0, 0, 1, 0.3], [0, 0.3, 1, 0.24], [0, 0.54, 1, 0.24], [0, 0.78, 1, 0.22]],
        "wide": [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    },
}

SIZES = {"square": (1080, 1080), "portrait": (1080, 1350), "landscape": (1920, 1080)}

# The editor's default arrangement (app/src/main.js DEFAULT_PLAN).
DEFAULT_PLAN = [("photo", "pier"), ("scene", "skyline"), ("scene", "neon"),
                ("photo", "boulevard"), ("scene", "speedway"), ("scene", "palms"),
                ("scene", "beach")]


def panel_rects(layout_name, W, H):
    layout = LAYOUTS.get(layout_name, LAYOUTS["classic"])
    table = layout["tall"] if H >= W else layout["wide"]
    gutter = max(6, round(W * 0.011))
    inner_w, inner_h = W - gutter * 2, H - gutter * 2
    return [(gutter + fx * inner_w + gutter / 2, gutter + fy * inner_h + gutter / 2,
             fw * inner_w - gutter, fh * inner_h - gutter)
            for fx, fy, fw, fh in table]


def paste_photo(base, img, rect, oy=0):
    """Cover-fit a photo into a panel rectangle; oy (-1..1) shifts the framing."""
    x, y, w, h = (round(v) for v in rect)
    scale = max(w / img.width, h / img.height)
    resized = img.resize((max(w, round(img.width * scale)), max(h, round(img.height * scale))),
                         Image.LANCZOS)
    left = (resized.width - w) // 2
    top = round((resized.height - h) * (0.5 + oy / 2))
    base.paste(resized.crop((left, top, left + w, top + h)), (x, y))


def apply_grade(base, grade):
    W, H = base.size
    if grade == "neon":
        stops = [(0, (16, 0, 54, 71)), (0.45, (0, 60, 90, 13)), (1, (120, 0, 70, 66))]
        vignette_alpha = 76
    elif grade == "day":
        stops = [(0, (255, 246, 205, 33)), (1, (255, 140, 90, 26))]
        vignette_alpha = 36
    else:
        stops = [(0, (255, 176, 66, 26)), (0.55, (255, 94, 98, 13)), (1, (178, 34, 110, 61))]
        vignette_alpha = 76
    base.paste(Image.alpha_composite(base.convert("RGBA"), vgrad_rgba(W, H, stops)).convert("RGB"),
               (0, 0))
    yy, xx = np.mgrid[0:H, 0:W]
    dist = np.sqrt((xx - W / 2) ** 2 + (yy - H / 2) ** 2)
    r0, r1 = min(W, H) * 0.42, max(W, H) * 0.78
    alpha = np.clip((dist - r0) / (r1 - r0), 0, 1) * vignette_alpha
    vig = np.zeros((H, W, 4), dtype=np.uint8)
    vig[:, :, 0], vig[:, :, 1], vig[:, :, 2] = 12, 2, 24
    vig[:, :, 3] = alpha.astype(np.uint8)
    base.paste(Image.alpha_composite(base.convert("RGBA"),
                                     Image.fromarray(vig, "RGBA")).convert("RGB"), (0, 0))


def caption_lines(caption):
    words = caption.strip().upper().split()
    if not words:
        return []
    if len(words) <= 3:
        return words
    return [words[0], words[1], " ".join(words[2:])]


def draw_title_block(base, caption, subtitle):
    W, H = base.size
    lines = caption_lines(caption)
    if not lines and not subtitle.strip():
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    margin_x = W * 0.052
    cursor_y = H * 0.045
    if lines:
        size = min(W * 0.19, H * 0.13)
        font = ImageFont.truetype(FONT_BOLD, round(size))
        probe = ImageDraw.Draw(layer)
        widest = max(probe.textlength(line, font=font) for line in lines)
        if widest > W * 0.66:
            size = max(14, size * (W * 0.66) / widest)
            font = ImageFont.truetype(FONT_BOLD, round(size))
        stroke = max(1, round(size * 0.17))
        # Shadow: the keylined text, offset and blurred.
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        yy = cursor_y + size * 0.07
        for line in lines:
            shadow_draw.text((margin_x, yy), line, font=font, fill=(10, 4, 20, 140),
                             stroke_width=stroke, stroke_fill=(10, 4, 20, 140))
            yy += size * 0.94
        layer = Image.alpha_composite(layer, shadow.filter(ImageFilter.GaussianBlur(size * 0.16)))
        # Keyline, then the warm gradient running down the letterforms.
        block_h = round(size * 0.94 * len(lines)) + stroke * 2
        gradient = vgrad(W, block_h, [(0, (255, 255, 255)), (0.55, (255, 238, 248)),
                                      (1, (255, 199, 227))]).convert("RGBA")
        fill_mask = Image.new("L", (W, H), 0)
        fill_draw = ImageDraw.Draw(fill_mask)
        stroke_mask = Image.new("L", (W, H), 0)
        stroke_draw = ImageDraw.Draw(stroke_mask)
        yy = cursor_y
        for line in lines:
            fill_draw.text((margin_x, yy), line, font=font, fill=255)
            stroke_draw.text((margin_x, yy), line, font=font, fill=255,
                             stroke_width=stroke, stroke_fill=255)
            yy += size * 0.94
        keyline = Image.new("RGBA", (W, H), (23, 16, 13, 255))
        layer = Image.alpha_composite(layer, Image.composite(
            keyline, Image.new("RGBA", (W, H), (0, 0, 0, 0)), stroke_mask))
        fill_img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        fill_img.paste(gradient, (0, round(cursor_y) - stroke))
        layer = Image.alpha_composite(layer, Image.composite(
            fill_img, Image.new("RGBA", (W, H), (0, 0, 0, 0)), fill_mask))
        cursor_y += size * 0.94 * len(lines) + size * 0.18
    sub = subtitle.strip().upper()
    if sub:
        sub_size = min(W * 0.045, H * 0.034)
        font = ImageFont.truetype(FONT_BOLD, round(sub_size))
        probe = ImageDraw.Draw(layer)
        tracking = sub_size * 0.42
        text_w = sum(probe.textlength(ch, font=font) for ch in sub) + tracking * len(sub)
        pad = sub_size * 0.55
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        band_draw = ImageDraw.Draw(band)
        band_draw.rectangle([margin_x - pad * 0.4, cursor_y - sub_size * 0.28,
                             margin_x - pad * 0.4 + text_w + pad * 1.1,
                             cursor_y - sub_size * 0.28 + sub_size * 1.62],
                            fill=(12, 6, 24, 240))
        layer = Image.alpha_composite(layer, band)
        draw = ImageDraw.Draw(layer)
        cx = margin_x
        for ch in sub:
            draw.text((cx, cursor_y), ch, font=font, fill=(255, 210, 63, 255),
                      stroke_width=max(1, round(sub_size * 0.14)),
                      stroke_fill=(10, 5, 18, 230))
            cx += probe.textlength(ch, font=font) + tracking
    base.paste(Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB"), (0, 0))


def render_cover(W, H, layout, grade, caption, subtitle, samples, offsets=None):
    base = Image.new("RGB", (W, H), PAPER)
    rects = panel_rects(layout, W, H)
    for i, rect in enumerate(rects):
        kind, name = DEFAULT_PLAN[i % len(DEFAULT_PLAN)]
        if kind == "photo" and name in samples:
            paste_photo(base, samples[name], rect, oy=(offsets or {}).get(i, 0))
        else:
            scene = PAINTERS[name if kind == "scene" else "beach"]
            base.paste(scene(round(rect[2]), round(rect[3])), (round(rect[0]), round(rect[1])))
    apply_grade(base, grade)
    draw_title_block(base, caption, subtitle)
    return base


# ---------------------------------------------------------------- editor

def hgrad(w, h, c0, c1):
    t = np.linspace(0, 1, w)
    img = np.zeros((h, w, 3), dtype=np.uint8)
    for channel in range(3):
        img[:, :, channel] = (c0[channel] + (c1[channel] - c0[channel]) * t).astype(np.uint8)[None, :]
    return Image.fromarray(img, "RGB")


def spaced(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x


def wrapped(draw, xy, text, font, fill, width, step):
    x, y = xy
    line = ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) > width and line:
            draw.text((x, y), line, font=font, fill=fill)
            y += step
            line = word
        else:
            line = trial
    if line:
        draw.text((x, y), line, font=font, fill=fill)
        y += step
    return y


def render_editor(samples):
    W, H = 1280, 880
    img = vgrad(W, H, [(0, (46, 18, 84)), (0.55, (21, 11, 46)), (1, (11, 6, 24))])
    glow = radial_glow(W, H, 200, -60, 620, (120, 40, 140), 90)
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB"), (0, 0))
    draw = ImageDraw.Draw(img)
    bold29 = ImageFont.truetype(FONT_BOLD, 29)
    bold14 = ImageFont.truetype(FONT_BOLD, 14)
    bold13 = ImageFont.truetype(FONT_BOLD, 13)
    bold12 = ImageFont.truetype(FONT_BOLD, 12)
    reg13 = ImageFont.truetype(FONT_REG, 13)
    reg12 = ImageFont.truetype(FONT_REG, 12)
    muted = (185, 174, 214)
    ink = (244, 238, 252)
    gold = (255, 210, 63)
    draw.rounded_rectangle([28, 28, 368, 852], radius=14, fill=(26, 18, 51),
                           outline=(50, 35, 95))
    x = 50
    y = 44
    draw.text((x, y), "Vice Panels", font=bold29, fill=(255, 120, 190))
    y += 40
    y = wrapped(draw, (x, y),
                "Turn your photos into GTA-style cover art: a multi-panel Leonida "
                "collage with bold caption lettering and a sunset or neon grade, "
                "exported as a PNG. Photos are never uploaded.",
                reg13, muted, 296, 17)
    y += 4

    def section(title, yy):
        spaced(draw, (x, yy), title, bold12, gold, 2)
        return yy + 22

    def field(label, value, yy):
        draw.text((x, yy), label, font=reg12, fill=muted)
        draw.rounded_rectangle([x, yy + 17, x + 296, yy + 45], radius=8,
                               fill=(15, 10, 34), outline=(50, 35, 95))
        draw.text((x + 10, yy + 23), value, font=reg13, fill=ink)
        return yy + 53

    y = section("1 · YOUR PHOTOS", y)
    button = hgrad(118, 32, (255, 79, 163), (184, 58, 224))
    mask = Image.new("L", (118, 32), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 118, 32], radius=9, fill=255)
    img.paste(button, (x, y), mask)
    draw = ImageDraw.Draw(img)
    draw.text((x + 14, y + 7), "Add photos", font=bold13, fill=(255, 255, 255))
    y += 40
    for i, name in enumerate(["pier", "boulevard"]):
        thumb = samples[name].resize((64, 64))
        thumb_mask = Image.new("L", (64, 64), 0)
        ImageDraw.Draw(thumb_mask).rounded_rectangle([0, 0, 64, 64], radius=9, fill=255)
        img.paste(thumb, (x + i * 72, y), thumb_mask)
    draw = ImageDraw.Draw(img)
    y += 70
    y = wrapped(draw, (x, y),
                "Pick a panel on the cover, then click a photo to fill it. Drag "
                "it inside the preview to reposition it.",
                reg12, muted, 296, 15)
    draw.rectangle([x, y + 2, x + 13, y + 15], outline=muted, width=1)
    draw.text((x + 20, y), "Spread one photo across all panels", font=reg13, fill=ink)
    y += 24
    y = section("2 · THE SELECTED PANEL", y)
    draw.text((x, y), "Panel 1 of 7", font=bold14, fill=ink)
    y += 20
    y = field("Painted scene", "Sunset beach", y)
    draw.text((x, y), "Photo zoom", font=reg12, fill=muted)
    draw.line([(x, y + 24), (x + 296, y + 24)], fill=(90, 70, 140), width=3)
    draw.ellipse([x - 6, y + 18, x + 6, y + 30], fill=(255, 79, 163))
    y += 38
    y = section("3 · WORDS AND STYLE", y)
    y = field("Caption", "Vice Heat", y)
    y = field("Subtitle", "Leonida", y)
    y = field("Layout", "Classic collage", y)
    y = field("Colour grade", "Vice sunset", y)
    y = section("4 · EXPORT", y)
    labels = ["1080 × 1080", "1080 × 1350", "1920 × 1080"]
    for i, label in enumerate(labels):
        bx = x + i * 101
        active = i == 1
        draw.rounded_rectangle([bx, y, bx + 94, y + 30], radius=8, fill=(15, 10, 34),
                               outline=(47, 214, 242) if active else (50, 35, 95),
                               width=2 if active else 1)
        tw = draw.textlength(label, font=reg12)
        draw.text((bx + (94 - tw) / 2, y + 8), label, font=reg12,
                  fill=ink if active else muted)
    y += 38
    export_img = hgrad(296, 40, (255, 79, 163), (255, 138, 60))
    mask = Image.new("L", (296, 40), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 296, 40], radius=10, fill=255)
    img.paste(export_img, (x, y), mask)
    draw = ImageDraw.Draw(img)
    label = "Export PNG — 1080 x 1350"
    tw = draw.textlength(label, font=bold14)
    draw.text((x + (296 - tw) / 2, y + 11), label, font=bold14, fill=(255, 255, 255))

    cover = render_cover(659, 824, "classic", "sunset", "Vice Heat", "Leonida", samples)
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([502, 44, 502 + 659, 44 + 824], fill=(0, 0, 0, 150))
    img.paste(Image.alpha_composite(img.convert("RGBA"),
                                    shadow.filter(ImageFilter.GaussianBlur(14))).convert("RGB"),
              (0, 0))
    img.paste(cover, (494, 28))
    draw = ImageDraw.Draw(img)
    rect = panel_rects("classic", 659, 824)[0]
    rx, ry = 494 + rect[0], 28 + rect[1]
    rw, rh = rect[2], rect[3]
    cyan = (47, 214, 242)
    dash, gap = 11, 7
    xx = rx
    while xx < rx + rw:
        draw.line([(xx, ry), (min(xx + dash, rx + rw), ry)], fill=cyan, width=3)
        draw.line([(xx, ry + rh), (min(xx + dash, rx + rw), ry + rh)], fill=cyan, width=3)
        xx += dash + gap
    yy = ry
    while yy < ry + rh:
        draw.line([(rx, yy), (rx, min(yy + dash, ry + rh))], fill=cyan, width=3)
        draw.line([(rx + rw, yy), (rx + rw, min(yy + dash, ry + rh))], fill=cyan, width=3)
        yy += dash + gap
    return img


# ---------------------------------------------------------------- main

def save_jpeg(img, path):
    quality = 90
    while True:
        img.save(path, "JPEG", quality=quality)
        if path.stat().st_size <= 250_000 or quality <= 60:
            return path.stat().st_size
        quality -= 5


def main():
    samples = {name: Image.open(SAMPLES / f"{name}.jpg").convert("RGB")
               for name in ("pier", "boulevard")}
    OUT_DIR.mkdir(exist_ok=True)
    shots = json.loads((ROOT / "shots.json").read_text())
    for shot in shots:
        params = {k: v[0] for k, v in parse_qs(urlparse(shot["query"]).query).items()}
        if params.get("shot") == "editor":
            img = render_editor(samples)
        else:
            W, H = SIZES[params.get("size", "portrait")]
            # The square cover's photos were dragged up in the editor before
            # export, so their faces sit inside the wide strips.
            offsets = {0: -0.3, 3: -0.55} if shot["name"] == "4-square.jpg" else None
            img = render_cover(W, H, params.get("layout", "classic"),
                               params.get("grade", "sunset"),
                               params.get("caption", "Vice Heat"),
                               params.get("subtitle", "Leonida"), samples,
                               offsets=offsets)
            long_side = max(img.size)
            if long_side > 1280:
                scale = 1280 / long_side
                img = img.resize((round(img.width * scale), round(img.height * scale)),
                                 Image.LANCZOS)
        size = save_jpeg(img, OUT_DIR / shot["name"])
        print(f"{shot['name']}: {img.width}x{img.height}, {size} bytes")


if __name__ == "__main__":
    main()

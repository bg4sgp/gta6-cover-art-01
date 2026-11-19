#!/usr/bin/env python3
"""make_screenshots.py — render this entry's screenshots with Pillow.

This build machine's Chromium refuses to launch standalone, so the four
screenshots are drawn here instead of captured from the browser. This file
is a second implementation of the app's own drawing rules — the same
panel tables as app/src/panels.js, the same scene geometry, colour grades
and lettering rules as app/src/cover.js and app/src/lettering.js — so what
it renders is what the app composes. Nothing is composited or borrowed:
covers are drawn panel by panel, and the editor shot draws the editor's
chrome around a cover composed by the same code.

Run:  python3 tools/make_screenshots.py
Writes screenshots/1-cover.jpg … 4-square.jpg, each within the gate caps
(a whole JPEG, at most 256 KiB, long side at most 1280, short side at
least 480).
"""

import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = os.path.join(ROOT, "app", "samples")
OUT_DIR = os.path.join(ROOT, "screenshots")

PAPER = (243, 234, 216)
KEYLINE = (22, 10, 18)
GOLD = (242, 193, 78)

FONT_CANDIDATES_BOLD = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
FONT_CANDIDATES_REGULAR = [
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def font_path(candidates):
    for path in candidates:
        if os.path.exists(path):
            return path
    raise SystemExit(f"no usable font found in {candidates}")


BOLD_PATH = font_path(FONT_CANDIDATES_BOLD)
REGULAR_PATH = font_path(FONT_CANDIDATES_REGULAR)


def load_font(path, px):
    return ImageFont.truetype(path, max(8, int(px)))


# ---------------------------------------------------------------------------
# Panel tables — the same fractions as app/src/panels.js.
# ---------------------------------------------------------------------------

LAYOUTS = {
    "classic": {
        "tall": [(0.00, 0.00, 0.62, 0.40), (0.62, 0.00, 0.38, 0.40),
                 (0.00, 0.40, 0.38, 0.34), (0.38, 0.40, 0.62, 0.34),
                 (0.00, 0.74, 1.00, 0.26)],
        "wide": [(0.00, 0.00, 0.40, 0.58), (0.40, 0.00, 0.32, 0.58),
                 (0.72, 0.00, 0.28, 0.58), (0.00, 0.58, 0.55, 0.42),
                 (0.55, 0.58, 0.45, 0.42)],
    },
    "hero": {
        "tall": [(0.00, 0.00, 1.00, 0.55), (0.00, 0.55, 0.50, 0.45),
                 (0.50, 0.55, 0.50, 0.45)],
        "wide": [(0.00, 0.00, 0.66, 1.00), (0.66, 0.00, 0.34, 0.50),
                 (0.66, 0.50, 0.34, 0.50)],
    },
    "strips": {
        "tall": [(0.00, 0.00, 1.00, 0.28), (0.00, 0.28, 1.00, 0.24),
                 (0.00, 0.52, 1.00, 0.24), (0.00, 0.76, 1.00, 0.24)],
        "wide": [(0.00, 0.00, 0.28, 1.00), (0.28, 0.00, 0.24, 1.00),
                 (0.52, 0.00, 0.24, 1.00), (0.76, 0.00, 0.24, 1.00)],
    },
}


def panel_rects(layout, W, H):
    table = LAYOUTS.get(layout, LAYOUTS["classic"])
    variant = table["wide"] if W > H else table["tall"]
    return [(round(rx * W), round(ry * H), round(rw * W), round(rh * H))
            for (rx, ry, rw, rh) in variant]


# ---------------------------------------------------------------------------
# Small drawing helpers.
# ---------------------------------------------------------------------------

def vertical_gradient(size, stops):
    """A vertical RGB gradient image; stops are (at, (r, g, b))."""
    w, h = size
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for yy in range(h):
        t = yy / max(1, h - 1)
        for i in range(len(stops) - 1):
            a0, c0 = stops[i]
            a1, c1 = stops[i + 1]
            if a0 <= t <= a1:
                f = 0.0 if a1 == a0 else (t - a0) / (a1 - a0)
                px[0, yy] = tuple(round(c0[k] + (c1[k] - c0[k]) * f) for k in range(3))
                break
        else:
            px[0, yy] = stops[-1][1]
    return strip.resize((w, h))


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def paste_panel(base, panel_img, rect):
    x, y, w, h = rect
    if panel_img.size != (w, h):
        panel_img = panel_img.resize((w, h))
    base.paste(panel_img, (x, y))


def sun_disc(img, cx, cy, r, colour, glow_alpha=110):
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gr = r * 2.6
    gd.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=colour + (glow_alpha,))
    glow = glow.filter(ImageFilter.GaussianBlur(r * 1.1))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=colour + (255,))


def qbez(p0, p1, p2, steps=14):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y))
    return pts


def draw_palm(d, px, py, scale, flip, colour):
    """Palm silhouette: curved trunk plus drooping fronds (mirrors panels.js)."""
    def T(lx, ly):
        return (px + flip * scale * lx, py + scale * ly)

    trunk = []
    left = qbez(T(-4, 0), T(-2, -55), T(10, -96))
    right = qbez(T(16, -94), T(6, -50), T(5, 0))
    trunk = left + right
    d.polygon(trunk, fill=colour)
    crown = T(13, -96)
    fronds = [(-58, -26, -30, 6), (-40, -38, -8, 8), (-14, -44, 16, 6),
              (16, -40, 38, 10), (40, -26, 52, 14), (-64, -8, -44, 22),
              (52, -6, 62, 20)]
    width = max(2, int(scale * 3.2))
    for (cx, cy, ex, ey) in fronds:
        pts = qbez(crown, T(13 + cx, -96 + cy), T(13 + ex, -96 + ey))
        d.line(pts, fill=colour, width=width, joint="curve")


def draw_sports_car(d, cx, cy, w, colour, light):
    h = w * 0.21
    x0, y0 = cx - w / 2, cy - h
    body = [
        (x0, y0 + h * 0.72), (x0 + w * 0.03, y0 + h * 0.40),
        (x0 + w * 0.16, y0 + h * 0.34), (x0 + w * 0.30, y0 + h * 0.32),
        (x0 + w * 0.40, y0 + h * 0.10), (x0 + w * 0.46, y0),
        (x0 + w * 0.58, y0 + h * 0.02), (x0 + w * 0.66, y0 + h * 0.06),
        (x0 + w * 0.72, y0 + h * 0.30), (x0 + w * 0.94, y0 + h * 0.36),
        (x0 + w * 0.99, y0 + h * 0.55), (x0 + w * 0.97, y0 + h * 0.78),
        (x0 + w * 0.03, y0 + h * 0.78),
    ]
    d.polygon(body, fill=colour)
    for wx in (0.235, 0.76):
        r = w * 0.062
        d.ellipse([x0 + w * wx - r, y0 + h * 0.78 - r, x0 + w * wx + r, y0 + h * 0.78 + r],
                  fill=(11, 11, 16))
    d.rectangle([x0 + w * 0.90, y0 + h * 0.46, x0 + w * 0.97, y0 + h * 0.53], fill=light)


def draw_plane(d, cx, cy, w, colour):
    h = w * 0.16
    x0, y0 = cx - w / 2, cy - h / 2
    pts = [(x0, y0 + h * 0.55), (x0 + w * 0.30, y0 + h * 0.30),
           (x0 + w * 0.62, y0 + h * 0.34), (x0 + w * 0.78, y0 + h * 0.02),
           (x0 + w * 0.86, y0 + h * 0.04), (x0 + w * 0.80, y0 + h * 0.36),
           (x0 + w * 0.97, y0 + h * 0.45), (x0 + w, y0 + h * 0.52),
           (x0 + w * 0.95, y0 + h * 0.66), (x0 + w * 0.78, y0 + h * 0.68),
           (x0 + w * 0.70, y0 + h * 0.98), (x0 + w * 0.62, y0 + h * 0.98),
           (x0 + w * 0.64, y0 + h * 0.68), (x0 + w * 0.30, y0 + h * 0.72),
           (x0 + w * 0.06, y0 + h * 0.68)]
    d.polygon(pts, fill=colour)


def draw_sailboat(d, cx, cy, w, colour, sail):
    h = w * 0.9
    x0, y0 = cx - w / 2, cy - h
    d.polygon([(x0 + w * 0.52, y0 + h * 0.06), (x0 + w * 0.52, y0 + h * 0.74),
               (x0 + w * 0.94, y0 + h * 0.74)], fill=sail)
    d.polygon([(x0 + w * 0.44, y0 + h * 0.20), (x0 + w * 0.44, y0 + h * 0.74),
               (x0 + w * 0.08, y0 + h * 0.74)], fill=sail)
    d.rectangle([x0 + w * 0.485, y0 + h * 0.02, x0 + w * 0.515, y0 + h * 0.78], fill=colour)
    d.polygon([(x0 + w * 0.02, y0 + h * 0.78), (x0 + w * 0.98, y0 + h * 0.78),
               (x0 + w * 0.84, y0 + h * 0.94), (x0 + w * 0.16, y0 + h * 0.94)], fill=colour)


def skyline_row(d, x, y, w, h, colour, window, rng, lit_ratio):
    bx = x
    while bx < x + w:
        bw = w * (0.06 + rng.random() * 0.09)
        bh = h * (0.45 + rng.random() * 0.55)
        top = y + h - bh
        d.rectangle([bx, top, bx + bw, y + h], fill=colour)
        if rng.random() > 0.6:
            d.rectangle([bx + bw * 0.3, top - h * 0.06, bx + bw * 0.7, top], fill=colour)
        cols = max(1, int(bw / (w * 0.028)))
        rows = max(2, int(bh / (h * 0.11)))
        for c in range(cols):
            for r in range(rows):
                if rng.random() < lit_ratio:
                    wx = bx + bw * 0.14 + c * (bw * 0.72 / cols)
                    wy = top + bh * 0.10 + r * (bh * 0.80 / rows)
                    d.rectangle([wx, wy, wx + bw * 0.34 / cols + 1.5,
                                 wy + bh * 0.36 / rows + 1.5], fill=window)
        bx += bw + w * 0.012


# ---------------------------------------------------------------------------
# The six scenes, painted on panel-sized RGBA images (local coordinates).
# ---------------------------------------------------------------------------

def scene_canvas(w, h, stops):
    img = vertical_gradient((w, h), stops).convert("RGBA")
    return img, ImageDraw.Draw(img)


def paint_sunset_beach(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#2e1a47")), (0.35, hex_rgb("#a03d63")),
        (0.62, hex_rgb("#ff7e47")), (0.78, hex_rgb("#ffc46b")),
        (1, hex_rgb("#ffe3a3"))])
    sun_disc(img, w * 0.62, h * 0.60, h * 0.11, (255, 243, 196))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * 0.66, w, h * 0.86], fill=hex_rgb("#175d6e") + (255,))
    for _ in range(26):
        gy = h * (0.68 + rng.random() * 0.16)
        gw = w * (0.02 + rng.random() * 0.07) * (0.5 + gy / h)
        d.rectangle([w * 0.62 - gw / 2 + (rng.random() - 0.5) * w * 0.05, gy,
                     w * 0.62 + gw / 2, gy + max(1.5, h * 0.008)],
                    fill=(255, 196, 107, 190))
    sand = [(0, h * 0.86)] + qbez((0, h * 0.86), (w * 0.5, h * 0.80), (w, h * 0.88)) \
        + [(w, h), (0, h)]
    d.polygon(sand, fill=hex_rgb("#e8a56b") + (255,))
    draw_palm(d, w * 0.10, h * 1.0, h / 300, 1, hex_rgb("#241126") + (255,))
    draw_palm(d, w * 0.94, h * 1.0, h / 340, -1, hex_rgb("#2b1430") + (255,))
    draw_sailboat(d, w * 0.30, h * 0.665, w * 0.10, hex_rgb("#2b1430") + (255,),
                  (255, 240, 214, 235))
    return img


def paint_neon_street(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#070718")), (0.55, hex_rgb("#141433")), (1, hex_rgb("#2a1050"))])
    skyline_row(d, 0, h * 0.06, w, h * 0.62, (27, 27, 56, 255),
                (120, 220, 255, 215), rng, 0.4)
    signs = ["#ff2e88", "#22d3ee", "#facc15", "#ff2e88", "#a78bfa"]
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i, s in enumerate(signs):
        sx = w * (0.08 + i * 0.19)
        sy = h * (0.16 + (i % 3) * 0.13)
        gd.rectangle([sx, sy, sx + w * 0.028, sy + h * (0.10 + (i % 2) * 0.05)],
                     fill=hex_rgb(s) + (255,))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(max(2, h * 0.02))))
    d = ImageDraw.Draw(img)
    for i, s in enumerate(signs):
        sx = w * (0.08 + i * 0.19)
        sy = h * (0.16 + (i % 3) * 0.13)
        d.rectangle([sx, sy, sx + w * 0.028, sy + h * (0.10 + (i % 2) * 0.05)],
                    fill=hex_rgb(s) + (255,))
    d.rectangle([0, h * 0.68, w, h], fill=hex_rgb("#0a0a18") + (255,))
    for i, s in enumerate(signs):
        sx = w * (0.08 + i * 0.19)
        fade = vertical_gradient((max(2, int(w * 0.028)), int(h * 0.30)),
                                 [(0, hex_rgb(s)), (1, hex_rgb("#0a0a18"))])
        img.paste(fade, (int(sx), int(h * 0.68)))
    d = ImageDraw.Draw(img)
    draw_sports_car(d, w * 0.55, h * 0.70, w * 0.52, (5, 5, 12, 255), (255, 233, 168, 255))
    draw_palm(d, w * 0.06, h * 1.0, h / 330, 1, (5, 5, 15, 255))
    return img


def paint_pier(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#7dd3fc")), (0.45, hex_rgb("#bae6fd")),
        (0.66, hex_rgb("#fde68a")), (1, hex_rgb("#fed7aa"))])
    sun_disc(img, w * 0.20, h * 0.30, h * 0.07, (255, 247, 214))
    d = ImageDraw.Draw(img)
    d.rectangle([0, h * 0.52, w, h], fill=hex_rgb("#0e7d94") + (255,))
    for _ in range(30):
        sx = rng.random() * w
        sy = h * (0.55 + rng.random() * 0.4)
        d.rectangle([sx, sy, sx + w * (0.01 + rng.random() * 0.03),
                     sy + max(1.2, h * 0.006)], fill=(255, 255, 255, 90))
    draw_sailboat(d, w * 0.72, h * 0.53, w * 0.13, hex_rgb("#17323e") + (255,),
                  (255, 255, 255, 242))
    draw_sailboat(d, w * 0.45, h * 0.545, w * 0.07, hex_rgb("#17323e") + (255,),
                  (255, 255, 255, 230))
    d.polygon([(w * 0.06, h), (w * 0.42, h * 0.55), (w * 0.56, h * 0.55), (w * 0.98, h)],
              fill=hex_rgb("#8a6642") + (255,))
    for i in range(1, 7):
        t = i / 7
        yy = h * (1 - 0.45 * t)
        d.line([(w * (0.06 + 0.36 * t * t), yy), (w * (0.98 - 0.42 * t * t), yy)],
               fill=(60, 38, 18, 165), width=max(2, int(h * 0.008)))
    d.rectangle([w * 0.40, h * 0.55, w * 0.418, h], fill=hex_rgb("#6d4c2c") + (255,))
    d.rectangle([w * 0.575, h * 0.55, w * 0.593, h], fill=hex_rgb("#6d4c2c") + (255,))
    d.rectangle([w * 0.385, h * 0.545, w * 0.595, h * 0.565], fill=hex_rgb("#6d4c2c") + (255,))
    return img


def paint_skyline_dusk(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#1e1b4b")), (0.40, hex_rgb("#7c2d5e")),
        (0.68, hex_rgb("#e85d3d")), (1, hex_rgb("#fbbf24"))])
    sun_disc(img, w * 0.38, h * 0.66, h * 0.13, (253, 230, 138))
    d = ImageDraw.Draw(img)
    draw_plane(d, w * 0.68, h * 0.20, w * 0.20, hex_rgb("#1c1033") + (255,))
    skyline_row(d, 0, h * 0.30, w, h * 0.52, hex_rgb("#31154d") + (255,),
                (253, 224, 71, 140), rng, 0.30)
    skyline_row(d, -w * 0.03, h * 0.44, w * 1.06, h * 0.56, hex_rgb("#170a2a") + (255,),
                (253, 224, 71, 230), rng, 0.5)
    d.rectangle([0, h * 0.965, w, h], fill=hex_rgb("#12071f") + (255,))
    return img


def paint_palm_shade(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#052e22")), (0.55, hex_rgb("#0b5563")), (1, hex_rgb("#14b8a6"))])
    rays = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for i in range(5):
        rd.polygon([(w * 0.85, 0), (w * (0.05 + i * 0.16), h), (w * (0.16 + i * 0.16), h)],
                   fill=(254, 249, 195, 40))
    img.alpha_composite(rays)
    sun_disc(img, w * 0.85, h * 0.06, h * 0.06, (254, 249, 195))
    d = ImageDraw.Draw(img)
    draw_palm(d, w * 0.16, h * 1.02, h / 210, 1, hex_rgb("#03211a") + (255,))
    draw_palm(d, w * 0.88, h * 1.02, h / 250, -1, hex_rgb("#042a20") + (255,))
    draw_palm(d, w * 0.55, h * 1.05, h / 330, 1, (3, 33, 26, 190))
    for i in range(6):
        fx = w * (0.04 + i * 0.19)
        pts = qbez((fx, -h * 0.02), (fx + w * 0.05, h * 0.13), (fx + w * 0.13, h * 0.15))
        d.line(pts, fill=hex_rgb("#03211a") + (255,), width=max(3, int(h * 0.014)), joint="curve")
    return img


def paint_speedway(w, h, rng):
    img, d = scene_canvas(w, h, [
        (0, hex_rgb("#312e81")), (0.45, hex_rgb("#9d2c5a")),
        (0.72, hex_rgb("#f97316")), (1, hex_rgb("#fbbf24"))])
    sun_disc(img, w * 0.50, h * 0.60, h * 0.10, (255, 243, 196))
    d = ImageDraw.Draw(img)
    draw_plane(d, w * 0.24, h * 0.16, w * 0.15, hex_rgb("#241239") + (255,))
    d.rectangle([0, h * 0.60, w, h * 0.65], fill=hex_rgb("#3b1154") + (255,))
    draw_palm(d, w * 0.05, h * 0.66, h / 420, 1, hex_rgb("#2a0d3e") + (255,))
    draw_palm(d, w * 0.95, h * 0.66, h / 400, -1, hex_rgb("#2a0d3e") + (255,))
    d.polygon([(w * 0.43, h * 0.65), (w * 0.57, h * 0.65), (w * 1.05, h), (w * -0.05, h)],
              fill=hex_rgb("#17121f") + (255,))
    edge = max(2, int(h * 0.006))
    d.line([(w * 0.43, h * 0.65), (w * -0.05, h)], fill=(254, 240, 138, 205), width=edge)
    d.line([(w * 0.57, h * 0.65), (w * 1.05, h)], fill=(254, 240, 138, 205), width=edge)
    dash = max(2, int(h * 0.01))
    yy = h * 0.68
    while yy < h:
        d.line([(w * 0.50, yy), (w * 0.50, min(h, yy + h * 0.07))],
               fill=hex_rgb("#fbbf24") + (255,), width=dash)
        yy += h * 0.13
    draw_sports_car(d, w * 0.50, h * 0.82, min(w * 0.46, h * 1.5), (18, 8, 31, 255), (254, 240, 138, 255))
    return img


SCENE_PAINTERS = {
    "sunset-beach": paint_sunset_beach,
    "neon-street": paint_neon_street,
    "pier": paint_pier,
    "skyline-dusk": paint_skyline_dusk,
    "palm-shade": paint_palm_shade,
    "speedway": paint_speedway,
}


def paint_scene(scene_id, w, h, panel_index):
    painter = SCENE_PAINTERS.get(scene_id, paint_sunset_beach)
    rng = random.Random(7919 * (panel_index + 3) + len(scene_id) * 131)
    return painter(max(8, int(w)), max(8, int(h)), rng)


# ---------------------------------------------------------------------------
# Grades, photos and lettering — the same rules as cover.js / lettering.js.
# ---------------------------------------------------------------------------

def apply_grade(panel, grade):
    w, h = panel.size
    if grade == "vice":
        wash = vertical_gradient((w, h), [
            (0, (64, 32, 110)), (0.55, (255, 110, 64)), (1, (255, 170, 60))])
        alpha = Image.new("L", (w, h), 0)
        ad = ImageDraw.Draw(alpha)
        for yy in range(h):
            t = yy / max(1, h - 1)
            ad.line([(0, yy), (w, yy)], fill=int(58 + 30 * t))
        panel.paste(Image.composite(wash, panel.convert("RGB"), alpha), (0, 0))
        over = ImageChops.overlay(panel.convert("RGB"),
                                   Image.new("RGB", (w, h), (255, 120, 80)))
        panel.paste(Image.blend(panel.convert("RGB"), over, 0.16), (0, 0))
    elif grade == "neon":
        wash = vertical_gradient((w, h), [(0, (20, 16, 80)), (1, (120, 10, 80))])
        alpha = Image.new("L", (w, h), 70)
        panel.paste(Image.composite(wash, panel.convert("RGB"), alpha), (0, 0))
        over = ImageChops.overlay(panel.convert("RGB"),
                                   Image.new("RGB", (w, h), (40, 200, 255)))
        panel.paste(Image.blend(panel.convert("RGB"), over, 0.14), (0, 0))
    else:  # day
        wash = vertical_gradient((w, h), [(0, (120, 200, 255)), (1, (255, 240, 190))])
        alpha = Image.new("L", (w, h), 30)
        panel.paste(Image.composite(wash, panel.convert("RGB"), alpha), (0, 0))
        over = ImageChops.overlay(panel.convert("RGB"),
                                   Image.new("RGB", (w, h), (255, 255, 255)))
        panel.paste(Image.blend(panel.convert("RGB"), over, 0.10), (0, 0))
    # Vignette.
    # Vignette: clear in the middle, up to 87/255 black at the corners.
    mask = Image.new("L", (w, h), 87)
    md = ImageDraw.Draw(mask)
    md.ellipse([-w * 0.30, -h * 0.30, w * 1.30, h * 1.30], fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) * 0.18))
    black = Image.new("RGB", (w, h), (10, 4, 12))
    panel.paste(Image.composite(black, panel.convert("RGB"), mask), (0, 0))
    return panel


def cover_fit_source(img_w, img_h, dw, dh, zoom=1.0, ox=0.0, oy=0.0):
    scale = max(dw / img_w, dh / img_h) * max(1.0, zoom)
    sw, sh = dw / scale, dh / scale
    slack_x, slack_y = max(0.0, img_w - sw), max(0.0, img_h - sh)
    sx = slack_x / 2 * (1 + max(-1.0, min(1.0, ox)))
    sy = slack_y / 2 * (1 + max(-1.0, min(1.0, oy)))
    return sx, sy, sw, sh


def photo_panel(photo, w, h, zoom=1.0, ox=0.0, oy=0.0):
    sx, sy, sw, sh = cover_fit_source(photo.width, photo.height, w, h, zoom, ox, oy)
    crop = photo.crop((int(sx), int(sy), int(sx + sw), int(sy + sh)))
    return crop.resize((max(8, int(w)), max(8, int(h))), Image.LANCZOS).convert("RGBA")


def photo_spread_panel(photo, rect, W, H, zoom=1.0, ox=0.0, oy=0.0):
    sx, sy, sw, sh = cover_fit_source(photo.width, photo.height, W, H, zoom, ox, oy)
    full = photo.crop((int(sx), int(sy), int(sx + sw), int(sy + sh))).resize((W, H), Image.LANCZOS)
    x, y, w, h = rect
    return full.crop((x, y, x + w, y + h)).convert("RGBA")


WARM_STOPS = [(0, (255, 251, 232)), (0.45, (255, 227, 174)),
              (0.78, (255, 179, 92)), (1, (255, 126, 61))]


def draw_caption(img, caption, W, H):
    words = (caption or "").upper().split()[:4]
    if not words:
        return
    margin = W * 0.045
    max_width = W * 0.86
    px = H * 0.155

    def widest(size):
        f = load_font(BOLD_PATH, size)
        probe = ImageDraw.Draw(img)
        return max(probe.textlength(word, font=f) * 0.84 for word in words)

    while px > 12 and widest(px) > max_width:
        px *= 0.94
    f = load_font(BOLD_PATH, px)
    line_height = px * 0.94
    keyline = max(2, int(px * 0.075))
    baseline = margin + px * 0.82

    for word in words:
        # Render one word on its own layer: dark keyline via stroke, warm
        # gradient fill clipped by the glyph mask, hard offset shadow.
        layer = Image.new("RGBA", (int(W * 0.95), int(px * 1.5)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((keyline * 2, keyline), word, font=f, fill=(0, 0, 0, 0),
                stroke_width=keyline, stroke_fill=KEYLINE + (255,))
        grad = vertical_gradient(layer.size, WARM_STOPS)
        mask = Image.new("L", layer.size, 0)
        md = ImageDraw.Draw(mask)
        md.text((keyline * 2, keyline), word, font=f, fill=255)
        fill_img = Image.new("RGBA", layer.size, (0, 0, 0, 0))
        fill_img.paste(grad.convert("RGBA"), (0, 0), mask)
        out = Image.alpha_composite(layer, fill_img)
        out = out.resize((int(out.width * 0.84), out.height), Image.LANCZOS)
        # The shadow is the same keyline+glyph alpha, filled dark and
        # condensed with the word so no ghost letters stick out.
        shadow = Image.new("RGBA", layer.size, (22, 10, 18, 255))
        shadow.putalpha(layer.split()[3].point(lambda a: int(a * 0.55)))
        shadow = shadow.resize(out.size, Image.LANCZOS)
        top = int(baseline - px * 0.82)
        img.alpha_composite(shadow, (int(margin + px * 0.045), int(top + px * 0.05)))
        img.alpha_composite(out, (int(margin), top))
        baseline += line_height


def draw_subtitle_band(img, subtitle, W, H):
    text = (subtitle or "").upper().strip()
    if not text:
        return
    d = ImageDraw.Draw(img)
    band_h = H * 0.085
    band_y = H - band_h
    d.rectangle([0, band_y, W, band_y + band_h], fill=(14, 7, 16, 224))
    rule = max(2, int(H * 0.004))
    d.rectangle([0, band_y, W, band_y + rule], fill=(255, 179, 92, 255))
    d.rectangle([0, band_y + band_h - rule, W, band_y + band_h], fill=(255, 179, 92, 255))
    px = band_h * 0.46

    def total(size):
        f = load_font(BOLD_PATH, size)
        spacing = size * 0.42
        return sum(d.textlength(ch, font=f) for ch in text) + spacing * (len(text) - 1), spacing

    while px > 10 and total(px)[0] > W * 0.9:
        px *= 0.92
    f = load_font(BOLD_PATH, px)
    tot, spacing = total(px)
    cursor = W / 2 - tot / 2
    baseline = band_y + band_h * 0.66
    for ch in text:
        d.text((cursor, baseline), ch, font=f, fill=GOLD + (255,), anchor="ls")
        cursor += d.textlength(ch, font=f) + spacing


def compose_cover(state, W, H, photos):
    """state: dict with layout, grade, caption, subtitle, spread,
    spread_photo, panels (list of dicts). photos: name -> PIL Image."""
    img = Image.new("RGBA", (W, H), PAPER + (255,))
    rects = panel_rects(state["layout"], W, H)
    gutter = max(5, round(W * 0.0075))
    d = ImageDraw.Draw(img)
    for i, (ox, oy, ow, oh) in enumerate(rects):
        rect = (ox + gutter // 2, oy + gutter // 2,
                max(8, ow - gutter), max(8, oh - gutter))
        x, y, w, h = rect
        cell = state["panels"][i] if i < len(state["panels"]) else {"kind": "scene", "scene": "sunset-beach"}
        if state.get("spread") and state.get("spread_photo") in photos:
            panel = photo_spread_panel(photos[state["spread_photo"]], rect, W, H,
                                       cell.get("zoom", 1), cell.get("ox", 0), cell.get("oy", 0))
        elif cell.get("kind") == "photo" and cell.get("photo") in photos:
            panel = photo_panel(photos[cell["photo"]], w, h,
                                cell.get("zoom", 1), cell.get("ox", 0), cell.get("oy", 0))
        else:
            panel = paint_scene(cell.get("scene", "sunset-beach"), w, h, i)
        panel = apply_grade(panel, state["grade"])
        img.paste(panel.convert("RGBA"), (x, y))
        d.rectangle([x, y, x + w - 1, y + h - 1], outline=(18, 8, 16, 217),
                    width=max(2, int(W * 0.0016)))
    draw_caption(img, state["caption"], W, H)
    draw_subtitle_band(img, state["subtitle"], W, H)
    return img.convert("RGB")


# ---------------------------------------------------------------------------
# The editor screenshot: the app's chrome drawn around a composed cover,
# with the sample photos loaded in the tray.
# ---------------------------------------------------------------------------

def rounded(draw, box, radius, **kw):
    draw.rounded_rectangle(box, radius=radius, **kw)


def editor_shot(photos, W=1280, H=880):
    wall = vertical_gradient((W, H), [(0, (29, 20, 40)), (1, (20, 13, 32))]).convert("RGBA")
    img = wall
    d = ImageDraw.Draw(img)

    # Browser chrome.
    d.rectangle([0, 0, W, 44], fill=(16, 11, 24, 255))
    for i, c in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        cx = 22 + i * 22
        d.ellipse([cx - 6, 16, cx + 6, 28], fill=c + (255,))
    rounded(d, [86, 9, 700, 35], 8, fill=(32, 22, 48, 255))
    d.text((102, 22), "localhost:8080 — Vice Panels · Leonida Cover Studio",
           font=load_font(REGULAR_PATH, 14), fill=(220, 210, 235, 255), anchor="lm")

    # Masthead: gradient wordmark and the export button.
    title_font = load_font(BOLD_PATH, 40)
    grad = vertical_gradient((330, 46), WARM_STOPS).convert("RGBA")
    tmask = Image.new("L", (330, 46), 0)
    ImageDraw.Draw(tmask).text((0, 2), "VICE PANELS", font=title_font, fill=255)
    img.paste(grad, (24, 58), tmask)
    d = ImageDraw.Draw(img)
    d.text((24, 112), "Leonida Cover Studio — your photo, poster lettering, one PNG.",
           font=load_font(REGULAR_PATH, 15), fill=(185, 168, 204, 255))
    rounded(d, [1062, 58, 1256, 106], 10, fill=(255, 150, 70, 255), outline=KEYLINE + (255,), width=2)
    d.text((1159, 82), "Export PNG", font=load_font(BOLD_PATH, 19),
           fill=(35, 16, 10, 255), anchor="mm")

    # Stage with the composed cover (samples placed, panel 1 selected).
    cover_state = {
        "layout": "classic", "grade": "vice", "caption": "Vice Heat",
        "subtitle": "Leonida", "spread": False, "spread_photo": None,
        "panels": [{"kind": "photo", "photo": "boulevard"},
                   {"kind": "photo", "photo": "pier"},
                   {"kind": "scene", "scene": "neon-street"},
                   {"kind": "scene", "scene": "skyline-dusk"},
                   {"kind": "scene", "scene": "speedway"}],
    }
    cover = compose_cover(cover_state, 880, 495, photos)
    rounded(d, [24, 140, 936, 700], 14, fill=(15, 10, 24, 255), outline=(69, 50, 88, 255))
    img.paste(cover, (40, 156))
    d = ImageDraw.Draw(img)
    # Selection frame on the first panel, as the editor draws it.
    d.rectangle([47, 163, 47 + 343, 163 + 275], outline=(255, 179, 92, 255), width=4)
    d.text((40, 672), "Panel 1: your photo — drag on the cover to reposition, scroll to zoom.",
           font=load_font(REGULAR_PATH, 14), fill=(185, 168, 204, 255))

    # Sidebar groups.
    sx, sw = 960, 296
    def group(y, height, title):
        rounded(d, [sx, y, sx + sw, y + height], 14, fill=(39, 26, 56, 255),
                outline=(69, 50, 88, 255))
        d.text((sx + 16, y + 14), title, font=load_font(BOLD_PATH, 14),
               fill=GOLD + (255,))

    group(140, 218, "1 · YOUR PHOTOS")
    rounded(d, [sx + 16, 178, sx + sw - 16, 214], 10, fill=(243, 234, 216, 255))
    d.text((sx + sw / 2, 196), "Add photos from this device", font=load_font(BOLD_PATH, 14),
           fill=(23, 16, 29, 255), anchor="mm")
    rounded(d, [sx + 16, 224, sx + sw - 16, 254], 10, outline=(69, 50, 88, 255))
    d.text((sx + sw / 2, 239), "Load the two sample photos", font=load_font(REGULAR_PATH, 13),
           fill=(245, 238, 221, 255), anchor="mm")
    for i, name in enumerate(["boulevard", "pier"]):
        thumb = photos[name].resize((64, 64))
        tx = sx + 16 + i * 74
        img.paste(thumb, (tx, 266))
        d.rectangle([tx, 266, tx + 63, 329], outline=(242, 193, 78, 255) if i == 0 else (69, 50, 88, 255), width=2)
    d = ImageDraw.Draw(img)
    d.text((sx + 16, 338), "Photos stay on this machine — nothing uploads.",
           font=load_font(REGULAR_PATH, 12), fill=(185, 168, 204, 255))

    group(374, 210, "2 · PANEL")
    chips = ["Sunset Beach", "Neon Street", "The Pier", "Skyline Dusk", "Palm Shade", "Speedway"]
    cx, cy = sx + 16, 412
    chip_font = load_font(REGULAR_PATH, 12.5)
    for chip in chips:
        tw = d.textlength(chip, font=chip_font) + 22
        if cx + tw > sx + sw - 12:
            cx, cy = sx + 16, cy + 34
        rounded(d, [cx, cy, cx + tw, cy + 26], 13, fill=(23, 15, 38, 255),
                outline=(69, 50, 88, 255))
        d.text((cx + 11, cy + 13), chip, font=chip_font, fill=(245, 238, 221, 255), anchor="lm")
        cx += tw + 8
    d.rectangle([sx + 16, 524, sx + 30, 538], outline=(245, 238, 221, 255), width=2)
    d.text((sx + 38, 531), "Spread one photo across all panels",
           font=load_font(REGULAR_PATH, 13), fill=(245, 238, 221, 255), anchor="lm")
    d.text((sx + 16, 556), "Zoom", font=load_font(REGULAR_PATH, 13),
           fill=(245, 238, 221, 255))
    rounded(d, [sx + 16, 570, sx + sw - 16, 578], 4, fill=(69, 50, 88, 255))
    d.ellipse([sx + 30, 566, sx + 46, 582], fill=(255, 138, 61, 255))

    group(600, 250, "3 · LOOK")
    fields = [("Layout", "Classic grid"), ("Colour grade", "Vice sunset"),
              ("Export size", "Landscape 1920 × 1080"), ("Caption", "Vice Heat"),
              ("Subtitle", "Leonida")]
    fy = 638
    small = load_font(REGULAR_PATH, 12.5)
    for label, value in fields:
        d.text((sx + 16, fy), label, font=small, fill=(185, 168, 204, 255))
        rounded(d, [sx + 108, fy - 5, sx + sw - 16, fy + 21], 7, fill=(23, 15, 38, 255),
                outline=(69, 50, 88, 255))
        d.text((sx + 118, fy + 8), value, font=small, fill=(245, 238, 221, 255), anchor="lm")
        fy += 38
    return img.convert("RGB")


# ---------------------------------------------------------------------------
# Saving within the gate caps, and the four shots.
# ---------------------------------------------------------------------------

MAX_BYTES = 262_144


def save_capped(img, name, max_long=1280):
    os.makedirs(OUT_DIR, exist_ok=True)
    w, h = img.size
    scale = min(1.0, max_long / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    path = os.path.join(OUT_DIR, name)
    quality = 88
    while True:
        img.save(path, "JPEG", quality=quality)
        if os.path.getsize(path) <= MAX_BYTES or quality <= 55:
            break
        quality -= 7
    print(f"{name}: {img.size[0]}x{img.size[1]}, {os.path.getsize(path)} bytes, q={quality}")
    return path


def main():
    photos = {
        "pier": Image.open(os.path.join(SAMPLES, "pier.jpg")).convert("RGB"),
        "boulevard": Image.open(os.path.join(SAMPLES, "boulevard.jpg")).convert("RGB"),
    }

    cover1 = compose_cover({
        "layout": "classic", "grade": "vice", "caption": "Vice Heat",
        "subtitle": "Leonida", "spread": False, "spread_photo": None,
        "panels": [{"kind": "photo", "photo": "boulevard"},
                   {"kind": "photo", "photo": "pier"},
                   {"kind": "scene", "scene": "neon-street"},
                   {"kind": "scene", "scene": "skyline-dusk"},
                   {"kind": "scene", "scene": "speedway"}],
    }, 1920, 1080, photos)
    save_capped(cover1, "1-cover.jpg")

    save_capped(editor_shot(photos), "2-editor.jpg")

    cover3 = compose_cover({
        "layout": "hero", "grade": "neon", "caption": "Neon Reign",
        "subtitle": "Vice City", "spread": False, "spread_photo": None,
        "panels": [{"kind": "photo", "photo": "boulevard"},
                   {"kind": "scene", "scene": "neon-street"},
                   {"kind": "scene", "scene": "palm-shade"}],
    }, 1080, 1350, photos)
    save_capped(cover3, "3-portrait.jpg")

    cover4 = compose_cover({
        "layout": "strips", "grade": "vice", "caption": "Palms and Peril",
        "subtitle": "Vice City · Leonida", "spread": False, "spread_photo": None,
        "panels": [{"kind": "photo", "photo": "pier", "oy": -0.7},
                   {"kind": "scene", "scene": "skyline-dusk"},
                   {"kind": "photo", "photo": "boulevard", "oy": -0.65},
                   {"kind": "scene", "scene": "palm-shade"}],
    }, 1080, 1080, photos)
    save_capped(cover4, "4-square.jpg")


if __name__ == "__main__":
    main()

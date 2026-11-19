// panels.js — collage geometry and the painted Leonida scenes for Vice Panels.
//
// Two halves live here:
//   1. LAYOUTS: three collage tables (classic, hero, strips), each in a tall
//      and a wide variant, as fractions of the canvas so any export size
//      (1080x1080, 1080x1350, 1920x1080) shares the same composition.
//   2. SCENES: six procedural paintings drawn with canvas gradients and
//      silhouettes — no image files, no network, the same code path the
//      editor preview and the PNG export both use.
//
// Everything is deterministic: the little seeded rng below makes window
// lights and star fields identical on every run.

// mulberry32: tiny seeded random so painted detail never flickers between
// the preview and the export.
export function seededRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rects are {x, y, w, h} fractions of the whole canvas, in reading order.
export const LAYOUTS = {
  classic: {
    tall: [
      { x: 0.00, y: 0.00, w: 0.62, h: 0.40 },
      { x: 0.62, y: 0.00, w: 0.38, h: 0.40 },
      { x: 0.00, y: 0.40, w: 0.38, h: 0.34 },
      { x: 0.38, y: 0.40, w: 0.62, h: 0.34 },
      { x: 0.00, y: 0.74, w: 1.00, h: 0.26 },
    ],
    wide: [
      { x: 0.00, y: 0.00, w: 0.40, h: 0.58 },
      { x: 0.40, y: 0.00, w: 0.32, h: 0.58 },
      { x: 0.72, y: 0.00, w: 0.28, h: 0.58 },
      { x: 0.00, y: 0.58, w: 0.55, h: 0.42 },
      { x: 0.55, y: 0.58, w: 0.45, h: 0.42 },
    ],
  },
  hero: {
    tall: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.55 },
      { x: 0.00, y: 0.55, w: 0.50, h: 0.45 },
      { x: 0.50, y: 0.55, w: 0.50, h: 0.45 },
    ],
    wide: [
      { x: 0.00, y: 0.00, w: 0.66, h: 1.00 },
      { x: 0.66, y: 0.00, w: 0.34, h: 0.50 },
      { x: 0.66, y: 0.50, w: 0.34, h: 0.50 },
    ],
  },
  strips: {
    tall: [
      { x: 0.00, y: 0.00, w: 1.00, h: 0.28 },
      { x: 0.00, y: 0.28, w: 1.00, h: 0.24 },
      { x: 0.00, y: 0.52, w: 1.00, h: 0.24 },
      { x: 0.00, y: 0.76, w: 1.00, h: 0.24 },
    ],
    wide: [
      { x: 0.00, y: 0.00, w: 0.28, h: 1.00 },
      { x: 0.28, y: 0.00, w: 0.24, h: 1.00 },
      { x: 0.52, y: 0.00, w: 0.24, h: 1.00 },
      { x: 0.76, y: 0.00, w: 0.24, h: 1.00 },
    ],
  },
};

export const LAYOUT_NAMES = {
  classic: 'Classic grid',
  hero: 'Hero panel',
  strips: 'Film strips',
};

// Pixel rects for a layout on a W x H canvas. Square canvases use the tall
// tables; anything wider than tall uses the wide ones.
export function panelRects(layoutId, W, H) {
  const table = LAYOUTS[layoutId] || LAYOUTS.classic;
  const variant = W > H ? table.wide : table.tall;
  return variant.map((r) => ({
    x: Math.round(r.x * W),
    y: Math.round(r.y * H),
    w: Math.round(r.w * W),
    h: Math.round(r.h * H),
  }));
}

// ---------------------------------------------------------------------------
// Silhouette helpers. All take the panel box so a scene composes at any size.
// ---------------------------------------------------------------------------

function skyGradient(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [at, colour] of stops) g.addColorStop(at, colour);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  return g;
}

function sunDisc(ctx, cx, cy, r, colour, glowColour) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.6);
  glow.addColorStop(0, glowColour);
  glow.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2.6, cy - r * 2.6, r * 5.2, r * 5.2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// A palm: curved trunk plus a crown of drooping fronds, drawn as one filled
// silhouette path. flip mirrors it so palms can lean into the panel.
export function drawPalm(ctx, px, py, scale, flip, colour) {
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(flip * scale, scale);
  ctx.fillStyle = colour;
  // Trunk: a tapering curve rising 100 units.
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.quadraticCurveTo(-2, -55, 10, -96);
  ctx.lineTo(16, -94);
  ctx.quadraticCurveTo(6, -50, 5, 0);
  ctx.closePath();
  ctx.fill();
  // Fronds from the crown at (13, -96).
  ctx.translate(13, -96);
  const fronds = [
    [-58, -26, -30, 6], [-40, -38, -8, 8], [-14, -44, 16, 6],
    [16, -40, 38, 10], [40, -26, 52, 14], [-64, -8, -44, 22], [52, -6, 62, 20],
  ];
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  for (const [cx, cy, ex, ey] of fronds) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// Low sports-car silhouette: long bonnet, cabin hump, two wheels.
export function drawSportsCar(ctx, cx, cy, w, colour, lightColour) {
  const h = w * 0.21;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.72);
  ctx.quadraticCurveTo(w * 0.02, h * 0.38, w * 0.16, h * 0.34);
  ctx.quadraticCurveTo(w * 0.30, h * 0.32, w * 0.40, h * 0.10);
  ctx.quadraticCurveTo(w * 0.46, h * -0.04, w * 0.58, h * 0.02);
  ctx.quadraticCurveTo(w * 0.66, h * 0.06, w * 0.72, h * 0.30);
  ctx.quadraticCurveTo(w * 0.94, h * 0.36, w * 0.99, h * 0.55);
  ctx.quadraticCurveTo(w * 1.0, h * 0.72, w * 0.96, h * 0.78);
  ctx.lineTo(w * 0.86, h * 0.78);
  ctx.arc(w * 0.76, h * 0.78, w * 0.085, 0, Math.PI, true);
  ctx.lineTo(w * 0.335, h * 0.78);
  ctx.arc(w * 0.235, h * 0.78, w * 0.085, 0, Math.PI, true);
  ctx.lineTo(w * 0.03, h * 0.78);
  ctx.quadraticCurveTo(0, h * 0.78, 0, h * 0.72);
  ctx.closePath();
  ctx.fill();
  // Wheels and a headlight slash.
  ctx.fillStyle = '#0b0b10';
  for (const wx of [0.235, 0.76]) {
    ctx.beginPath();
    ctx.arc(w * wx, h * 0.78, w * 0.062, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = lightColour;
  ctx.fillRect(w * 0.90, h * 0.46, w * 0.07, h * 0.07);
  ctx.restore();
}

// Airliner silhouette crossing the sky.
export function drawPlane(ctx, cx, cy, w, colour) {
  const h = w * 0.16;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h / 2);
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  ctx.quadraticCurveTo(w * 0.30, h * 0.30, w * 0.62, h * 0.34);
  ctx.lineTo(w * 0.78, h * 0.02);
  ctx.lineTo(w * 0.86, h * 0.04);
  ctx.lineTo(w * 0.80, h * 0.36);
  ctx.quadraticCurveTo(w * 0.95, h * 0.40, w, h * 0.52);
  ctx.quadraticCurveTo(w * 0.95, h * 0.66, w * 0.78, h * 0.68);
  ctx.lineTo(w * 0.70, h * 0.98);
  ctx.lineTo(w * 0.62, h * 0.98);
  ctx.lineTo(w * 0.64, h * 0.68);
  ctx.quadraticCurveTo(w * 0.30, h * 0.72, w * 0.06, h * 0.68);
  ctx.quadraticCurveTo(0, h * 0.62, 0, h * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Sailboat: hull, mast and two sails.
export function drawSailboat(ctx, cx, cy, w, colour, sailColour) {
  const h = w * 0.9;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h);
  ctx.fillStyle = sailColour;
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.06);
  ctx.lineTo(w * 0.52, h * 0.74);
  ctx.lineTo(w * 0.94, h * 0.74);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.44, h * 0.20);
  ctx.lineTo(w * 0.44, h * 0.74);
  ctx.lineTo(w * 0.08, h * 0.74);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.fillRect(w * 0.485, h * 0.02, w * 0.03, h * 0.76);
  ctx.beginPath();
  ctx.moveTo(w * 0.02, h * 0.78);
  ctx.lineTo(w * 0.98, h * 0.78);
  ctx.lineTo(w * 0.84, h * 0.94);
  ctx.lineTo(w * 0.16, h * 0.94);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// A row of tower silhouettes with lit windows; rng keeps the lights stable.
function skylineRow(ctx, x, y, w, h, colour, windowColour, rng, litRatio) {
  ctx.fillStyle = colour;
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.06 + rng() * 0.09);
    const bh = h * (0.45 + rng() * 0.55);
    ctx.fillRect(bx, y + h - bh, bw, bh);
    if (rng() > 0.6) ctx.fillRect(bx + bw * 0.3, y + h - bh - h * 0.06, bw * 0.4, h * 0.06);
    ctx.fillStyle = windowColour;
    const cols = Math.max(1, Math.floor(bw / (w * 0.028)));
    const rows = Math.max(2, Math.floor(bh / (h * 0.11)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() < litRatio) {
          ctx.fillRect(
            bx + bw * 0.14 + c * (bw * 0.72 / cols),
            y + h - bh + bh * 0.10 + r * (bh * 0.80 / rows),
            bw * 0.34 / cols + 1.5,
            bh * 0.36 / rows + 1.5,
          );
        }
      }
    }
    ctx.fillStyle = colour;
    bx += bw + w * 0.012;
  }
}

// ---------------------------------------------------------------------------
// The six scenes. Each paints inside the given panel box only.
// ---------------------------------------------------------------------------

function paintSunsetBeach(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#2e1a47'], [0.35, '#a03d63'], [0.62, '#ff7e47'], [0.78, '#ffc46b'], [1, '#ffe3a3'],
  ]);
  sunDisc(ctx, x + w * 0.62, y + h * 0.60, h * 0.11, '#fff3c4', 'rgba(255,170,80,0.55)');
  // Sea band with a sun glitter path.
  ctx.fillStyle = '#175d6e';
  ctx.fillRect(x, y + h * 0.66, w, h * 0.20);
  ctx.fillStyle = 'rgba(255,196,107,0.75)';
  for (let i = 0; i < 26; i++) {
    const gy = y + h * (0.68 + rng() * 0.16);
    const gw = w * (0.02 + rng() * 0.07) * (0.5 + (gy - y) / h);
    ctx.fillRect(x + w * 0.62 - gw / 2 + (rng() - 0.5) * w * 0.05, gy, gw, Math.max(1.5, h * 0.008));
  }
  // Sand foreground.
  ctx.fillStyle = '#e8a56b';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.86);
  ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.80, x + w, y + h * 0.88);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  drawPalm(ctx, x + w * 0.10, y + h * 1.0, h / 300, 1, '#241126');
  drawPalm(ctx, x + w * 0.94, y + h * 1.0, h / 340, -1, '#2b1430');
  drawSailboat(ctx, x + w * 0.30, y + h * 0.665, w * 0.10, '#2b1430', 'rgba(255,240,214,0.92)');
}

function paintNeonStreet(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#070718'], [0.55, '#141433'], [1, '#2a1050'],
  ]);
  skylineRow(ctx, x, y + h * 0.06, w, h * 0.62, '#1b1b38', 'rgba(120,220,255,0.85)', rng, 0.4);
  // Neon signs: glowing rounded bars on the buildings.
  const signs = ['#ff2e88', '#22d3ee', '#facc15', '#ff2e88', '#a78bfa'];
  for (let i = 0; i < signs.length; i++) {
    const sx = x + w * (0.08 + i * 0.19);
    const sy = y + h * (0.16 + (i % 3) * 0.13);
    ctx.save();
    ctx.shadowColor = signs[i];
    ctx.shadowBlur = h * 0.05;
    ctx.fillStyle = signs[i];
    ctx.fillRect(sx, sy, w * 0.028, h * (0.10 + (i % 2) * 0.05));
    ctx.restore();
  }
  // Wet street with neon reflections.
  ctx.fillStyle = '#0a0a18';
  ctx.fillRect(x, y + h * 0.68, w, h * 0.32);
  for (let i = 0; i < signs.length; i++) {
    const sx = x + w * (0.08 + i * 0.19);
    const grad = ctx.createLinearGradient(0, y + h * 0.68, 0, y + h);
    grad.addColorStop(0, signs[i] + 'aa');
    grad.addColorStop(1, signs[i] + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, y + h * 0.68, w * 0.028, h * 0.30);
  }
  drawSportsCar(ctx, x + w * 0.55, y + h * 0.70, w * 0.52, '#05050c', '#ffe9a8');
  drawPalm(ctx, x + w * 0.06, y + h * 1.0, h / 330, 1, '#05050f');
}

function paintPier(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#7dd3fc'], [0.45, '#bae6fd'], [0.66, '#fde68a'], [1, '#fed7aa'],
  ]);
  sunDisc(ctx, x + w * 0.20, y + h * 0.30, h * 0.07, '#fff7d6', 'rgba(255,220,150,0.5)');
  ctx.fillStyle = '#0e7d94';
  ctx.fillRect(x, y + h * 0.52, w, h * 0.48);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 30; i++) {
    ctx.fillRect(x + rng() * w, y + h * (0.55 + rng() * 0.4), w * (0.01 + rng() * 0.03), Math.max(1.2, h * 0.006));
  }
  drawSailboat(ctx, x + w * 0.72, y + h * 0.53, w * 0.13, '#17323e', 'rgba(255,255,255,0.95)');
  drawSailboat(ctx, x + w * 0.45, y + h * 0.545, w * 0.07, '#17323e', 'rgba(255,255,255,0.9)');
  // Pier deck in perspective with posts and rails.
  ctx.fillStyle = '#8a6642';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h);
  ctx.lineTo(x + w * 0.42, y + h * 0.55);
  ctx.lineTo(x + w * 0.56, y + h * 0.55);
  ctx.lineTo(x + w * 0.98, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,38,18,0.65)';
  ctx.lineWidth = Math.max(1.5, h * 0.008);
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    ctx.beginPath();
    ctx.moveTo(x + w * (0.06 + 0.36 * t * t) + w * 0.0, y + h * (1 - 0.45 * t));
    ctx.lineTo(x + w * (0.98 - 0.42 * t * t), y + h * (1 - 0.45 * t));
    ctx.stroke();
  }
  ctx.fillStyle = '#6d4c2c';
  for (const px of [0.40, 0.575]) {
    ctx.fillRect(x + w * px, y + h * 0.55, w * 0.018, h * 0.45);
  }
  ctx.fillRect(x + w * 0.385, y + h * 0.545, w * 0.21, h * 0.02);
}

function paintSkylineDusk(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#1e1b4b'], [0.40, '#7c2d5e'], [0.68, '#e85d3d'], [1, '#fbbf24'],
  ]);
  sunDisc(ctx, x + w * 0.38, y + h * 0.66, h * 0.13, '#fde68a', 'rgba(251,146,60,0.5)');
  drawPlane(ctx, x + w * 0.68, y + h * 0.20, w * 0.20, '#1c1033');
  skylineRow(ctx, x, y + h * 0.30, w, h * 0.52, '#31154d', 'rgba(253,224,71,0.55)', rng, 0.30);
  skylineRow(ctx, x - w * 0.03, y + h * 0.44, w * 1.06, h * 0.56, '#170a2a', 'rgba(253,224,71,0.9)', rng, 0.5);
  // Waterline shimmer under the skyline.
  ctx.fillStyle = '#12071f';
  ctx.fillRect(x, y + h * 0.965, w, h * 0.035);
}

function paintPalmShade(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#052e22'], [0.55, '#0b5563'], [1, '#14b8a6'],
  ]);
  // Light rays fanning from the top corner.
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#fef9c3';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.85, y);
    ctx.lineTo(x + w * (0.05 + i * 0.16), y + h);
    ctx.lineTo(x + w * (0.16 + i * 0.16), y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  sunDisc(ctx, x + w * 0.85, y + h * 0.06, h * 0.06, '#fef9c3', 'rgba(254,249,195,0.45)');
  // Layered palms, dark against the teal light.
  drawPalm(ctx, x + w * 0.16, y + h * 1.02, h / 210, 1, '#03211a');
  drawPalm(ctx, x + w * 0.88, y + h * 1.02, h / 250, -1, '#042a20');
  drawPalm(ctx, x + w * 0.55, y + h * 1.05, h / 330, 1, 'rgba(3,33,26,0.75)');
  // Fronds hanging from the top edge.
  ctx.strokeStyle = '#03211a';
  ctx.lineWidth = Math.max(3, h * 0.014);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const fx = x + w * (0.04 + i * 0.19);
    ctx.beginPath();
    ctx.moveTo(fx, y - h * 0.02);
    ctx.quadraticCurveTo(fx + w * 0.05, y + h * 0.13, fx + w * 0.13, y + h * 0.15);
    ctx.stroke();
  }
}

function paintSpeedway(ctx, x, y, w, h, rng) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#312e81'], [0.45, '#9d2c5a'], [0.72, '#f97316'], [1, '#fbbf24'],
  ]);
  sunDisc(ctx, x + w * 0.50, y + h * 0.60, h * 0.10, '#fff3c4', 'rgba(255,170,80,0.5)');
  drawPlane(ctx, x + w * 0.24, y + h * 0.16, w * 0.15, '#241239');
  // Distant shore and palm rows.
  ctx.fillStyle = '#3b1154';
  ctx.fillRect(x, y + h * 0.60, w, h * 0.05);
  drawPalm(ctx, x + w * 0.05, y + h * 0.66, h / 420, 1, '#2a0d3e');
  drawPalm(ctx, x + w * 0.95, y + h * 0.66, h / 400, -1, '#2a0d3e');
  // Road rushing at the viewer.
  ctx.fillStyle = '#17121f';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.43, y + h * 0.65);
  ctx.lineTo(x + w * 0.57, y + h * 0.65);
  ctx.lineTo(x + w * 1.05, y + h);
  ctx.lineTo(x - w * 0.05, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(254,240,138,0.8)';
  ctx.lineWidth = Math.max(1.5, h * 0.006);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.43, y + h * 0.65);
  ctx.lineTo(x - w * 0.05, y + h);
  ctx.moveTo(x + w * 0.57, y + h * 0.65);
  ctx.lineTo(x + w * 1.05, y + h);
  ctx.stroke();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(2, h * 0.01);
  ctx.setLineDash([h * 0.07, h * 0.06]);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.50, y + h * 0.66);
  ctx.lineTo(x + w * 0.50, y + h);
  ctx.stroke();
  ctx.setLineDash([]);
  drawSportsCar(ctx, x + w * 0.50, y + h * 0.82, Math.min(w * 0.46, h * 1.5), '#12081f', '#fef08a');
}

export const SCENES = [
  { id: 'sunset-beach', name: 'Sunset Beach', paint: paintSunsetBeach },
  { id: 'neon-street', name: 'Neon Street', paint: paintNeonStreet },
  { id: 'pier', name: 'The Pier', paint: paintPier },
  { id: 'skyline-dusk', name: 'Skyline Dusk', paint: paintSkylineDusk },
  { id: 'palm-shade', name: 'Palm Shade', paint: paintPalmShade },
  { id: 'speedway', name: 'Speedway', paint: paintSpeedway },
];

// Paint one scene into a panel box, clipped so nothing spills over the
// paper gutter. The seed varies by scene and panel so details differ.
export function paintScene(ctx, sceneId, rect, panelIndex) {
  const scene = SCENES.find((s) => s.id === sceneId) || SCENES[0];
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  scene.paint(ctx, rect.x, rect.y, rect.w, rect.h, seededRng(7919 * (panelIndex + 3) + sceneId.length * 131));
  ctx.restore();
}

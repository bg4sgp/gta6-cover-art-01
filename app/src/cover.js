// cover.js — the composition engine: panels, photos, grades and lettering
// assembled into one cover on a canvas.
//
// A cover state looks like:
//   {
//     layout: 'classic' | 'hero' | 'strips',
//     grade: 'vice' | 'neon' | 'day',
//     caption: 'Vice Heat', subtitle: 'Leonida',
//     spread: false,               // one photo across every panel
//     spreadPhoto: <photo id>,     // which photo spreads
//     panels: [ { kind: 'scene', scene: 'sunset-beach' }
//             | { kind: 'photo', photo: <id>, zoom: 1, ox: 0, oy: 0 } ]
//   }
// Photos are resolved through a lookup the caller passes in, so this file
// never touches the DOM: id -> HTMLImageElement (or anything with
// width/height that drawImage accepts).

import { panelRects, paintScene } from './panels.js';
import { drawCaption, drawSubtitleBand } from './lettering.js';

export const PAPER = '#f3ead8';
export const GRADES = {
  vice: { name: 'Vice sunset' },
  neon: { name: 'Neon night' },
  day: { name: 'Leonida day' },
};

// The three export sizes the editor offers, in pixels.
export const SIZES = {
  square: { name: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  landscape: { name: 'Landscape 1920 × 1080', w: 1920, h: 1080 },
};

// Cover-fit geometry: the source rectangle of an image that fills a
// dw x dh box at the given zoom (1 = just cover) and offset (ox, oy in
// -1..1, sliding the crop window across the slack).
export function coverFitSource(imgW, imgH, dw, dh, zoom, ox, oy) {
  const scale = Math.max(dw / imgW, dh / imgH) * Math.max(1, zoom || 1);
  const sw = dw / scale;
  const sh = dh / scale;
  const slackX = Math.max(0, imgW - sw);
  const slackY = Math.max(0, imgH - sh);
  const sx = (slackX / 2) * (1 + Math.max(-1, Math.min(1, ox || 0)));
  const sy = (slackY / 2) * (1 + Math.max(-1, Math.min(1, oy || 0)));
  return { sx, sy, sw, sh };
}

function drawPhotoCover(ctx, img, rect, zoom, ox, oy) {
  const { sx, sy, sw, sh } = coverFitSource(img.width, img.height, rect.w, rect.h, zoom, ox, oy);
  ctx.drawImage(img, sx, sy, sw, sh, rect.x, rect.y, rect.w, rect.h);
}

// In spread mode the whole canvas is the photo's frame and each panel
// shows its own slice of it: draw the full-canvas cover-fit, clipped to
// the panel, so the panels tile one continuous picture.
function drawPhotoSpread(ctx, img, rect, W, H, zoom, ox, oy) {
  const { sx, sy, sw, sh } = coverFitSource(img.width, img.height, W, H, zoom, ox, oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  ctx.restore();
}

// Colour grade, painted over one panel: a translucent wash, a soft light
// from the top, and a vignette that darkens the corners so the panel reads
// as one photograph. Kept cheap on purpose — three fills per panel.
function applyGrade(ctx, rect, grade) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (grade === 'vice') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(64,32,110,0.20)');
    g.addColorStop(0.55, 'rgba(255,110,64,0.10)');
    g.addColorStop(1, 'rgba(255,170,60,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,120,80,0.16)';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'neon') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(20,16,80,0.30)');
    g.addColorStop(1, 'rgba(120,10,80,0.26)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(40,200,255,0.14)';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(120,200,255,0.10)');
    g.addColorStop(1, 'rgba(255,240,190,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Vignette.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.hypot(w, h) / 2;
  const v = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r);
  v.addColorStop(0, 'rgba(10,4,12,0)');
  v.addColorStop(1, 'rgba(10,4,12,0.34)');
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Draw the whole cover into ctx at W x H. photoById resolves photo ids.
// options.frame draws the editor's selection outline (never on exports).
export function composeCover(ctx, state, W, H, photoById, options = {}) {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const rects = panelRects(state.layout, W, H);
  const gutter = Math.max(5, Math.round(W * 0.0075));
  const spreadImg = state.spread && state.spreadPhoto != null
    ? photoById(state.spreadPhoto)
    : null;

  rects.forEach((outer, i) => {
    const rect = {
      x: outer.x + gutter / 2,
      y: outer.y + gutter / 2,
      w: Math.max(8, outer.w - gutter),
      h: Math.max(8, outer.h - gutter),
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();

    const cell = state.panels[i] || { kind: 'scene', scene: 'sunset-beach' };
    if (spreadImg) {
      drawPhotoSpread(ctx, spreadImg, rect, W, H, cell.zoom || 1, cell.ox || 0, cell.oy || 0);
    } else if (cell.kind === 'photo') {
      const img = photoById(cell.photo);
      if (img) drawPhotoCover(ctx, img, rect, cell.zoom, cell.ox, cell.oy);
      else paintScene(ctx, 'sunset-beach', rect, i);
    } else {
      paintScene(ctx, cell.scene, rect, i);
    }
    applyGrade(ctx, rect, state.grade);
    ctx.restore();

    // Keyline around every panel, like ink between poster cells.
    ctx.strokeStyle = 'rgba(18,8,16,0.85)';
    ctx.lineWidth = Math.max(1.5, W * 0.0016);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

    if (options.frame && options.selected === i) {
      ctx.strokeStyle = '#ffb35c';
      ctx.lineWidth = Math.max(3, W * 0.004);
      ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    }
  });

  drawCaption(ctx, state.caption, W, H);
  drawSubtitleBand(ctx, state.subtitle, W, H);
  ctx.restore();
  return rects;
}

// Which panel (by index) contains a canvas point, or -1 over the gutter.
export function panelAt(rects, px, py) {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return -1;
}

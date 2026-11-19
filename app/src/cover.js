// Cover composition for Vice Panels: lays the panels down on a paper frame,
// fills each with a photo or a painted scene, washes the whole collage with
// a colour grade, and finishes with the caption lettering.

import { panelRects, paintScene } from './panels.js';
import { drawTitleBlock } from './lettering.js';

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  landscape: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const GRADES = {
  sunset: 'Vice sunset',
  neon: 'Neon night',
  day: 'Leonida day',
};

export const PAPER = '#f7f1e3';

/**
 * Draws an image into a rectangle the way a poster panel takes a photo:
 * scaled to cover the rectangle, then shifted by the panel's offset
 * (ox, oy in -1..1 across the spare room) and zoomed around its centre.
 */
export function drawPhotoInPanel(ctx, img, rect, ox = 0, oy = 0, zoom = 1) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(rect.w / iw, rect.h / ih) * Math.max(1, zoom);
  const dw = iw * scale;
  const dh = ih * scale;
  const spareX = dw - rect.w;
  const spareY = dh - rect.h;
  const dx = rect.x - spareX * (0.5 + Math.max(-1, Math.min(1, ox)) * 0.5);
  const dy = rect.y - spareY * (0.5 + Math.max(-1, Math.min(1, oy)) * 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** The colour wash laid over the whole collage before the lettering goes on. */
export function applyGrade(ctx, W, H, grade) {
  ctx.save();
  if (grade === 'neon') {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(16, 0, 54, 0.28)');
    wash.addColorStop(0.45, 'rgba(0, 60, 90, 0.05)');
    wash.addColorStop(1, 'rgba(120, 0, 70, 0.26)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  } else if (grade === 'day') {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 246, 205, 0.13)');
    wash.addColorStop(1, 'rgba(255, 140, 90, 0.10)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  } else {
    const wash = ctx.createLinearGradient(0, 0, 0, H);
    wash.addColorStop(0, 'rgba(255, 176, 66, 0.10)');
    wash.addColorStop(0.55, 'rgba(255, 94, 98, 0.05)');
    wash.addColorStop(1, 'rgba(178, 34, 110, 0.24)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  }
  const vignette = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.78,
  );
  vignette.addColorStop(0, 'rgba(12, 2, 24, 0)');
  vignette.addColorStop(1, grade === 'day' ? 'rgba(12, 2, 24, 0.14)' : 'rgba(12, 2, 24, 0.3)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/**
 * Renders a whole cover into ctx at W x H.
 * state: { sizeKey, layout, grade, caption, subtitle, spread, panels }
 * Each panel: { mode: 'photo' | 'scene', img, scene, ox, oy, zoom }.
 * When spread is on and state.spreadImg is set, that one photo is laid over
 * the whole collage first and the panel gutters are cut through it, so a
 * single photo fills every panel at once.
 */
export function renderCover(ctx, W, H, state) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const rects = panelRects(state.layout, W, H);
  if (state.spread && state.spreadImg) {
    // One photo under the whole collage: each panel shows its own slice of
    // the full-cover placement, and the paper gutters cut between them.
    const iw = state.spreadImg.naturalWidth;
    const ih = state.spreadImg.naturalHeight;
    const scale = Math.max(W / iw, H / ih);
    const dx = (W - iw * scale) / 2;
    const dy = (H - ih * scale) / 2;
    for (const rect of rects) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      ctx.drawImage(state.spreadImg, dx, dy, iw * scale, ih * scale);
      ctx.restore();
    }
  } else {
    rects.forEach((rect, i) => {
      const panel = state.panels[i];
      if (!panel) {
        paintScene(ctx, 'beach', rect.x, rect.y, rect.w, rect.h);
      } else if (panel.mode === 'photo' && panel.img) {
        drawPhotoInPanel(ctx, panel.img, rect, panel.ox, panel.oy, panel.zoom);
      } else {
        paintScene(ctx, panel.scene, rect.x, rect.y, rect.w, rect.h);
      }
    });
  }
  applyGrade(ctx, W, H, state.grade);
  drawTitleBlock(ctx, W, H, state.caption, state.subtitle);
  return rects;
}

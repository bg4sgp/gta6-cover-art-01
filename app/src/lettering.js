// lettering.js — the cover's type: a stacked-word display caption and a
// gold letter-spaced subtitle on a dark band.
//
// Everything is drawn with the system font stack (no font files, nothing
// borrowed): heavy weight, tight leading, each caption word on its own line,
// a warm sunset gradient in the fill, a dark keyline around every glyph and
// a hard offset shadow — the poster look, in an original hand.

export const DISPLAY_FONT_STACK =
  "'Arial Narrow', 'Helvetica Neue Condensed', 'Liberation Sans Narrow', Arial, sans-serif";
export const SUBTITLE_FONT_STACK =
  "'Helvetica Neue', 'Segoe UI', Arial, sans-serif";

const KEYLINE = '#160a12';
const SHADOW = 'rgba(22,10,18,0.55)';

// Warm gradient for caption fills: near-white at the top melting through
// peach into sunset orange at the baseline.
function warmFill(ctx, top, height) {
  const g = ctx.createLinearGradient(0, top, 0, top + height);
  g.addColorStop(0, '#fffbe8');
  g.addColorStop(0.45, '#ffe3ae');
  g.addColorStop(0.78, '#ffb35c');
  g.addColorStop(1, '#ff7e3d');
  return g;
}

// Set the display font at a pixel size and return the metrics we need.
function setDisplayFont(ctx, px) {
  ctx.font = `900 ${px}px ${DISPLAY_FONT_STACK}`;
  ctx.textBaseline = 'alphabetic';
  return px;
}

// Widest word width at a given font size, used to fit the stack.
function stackWidth(ctx, words, px) {
  setDisplayFont(ctx, px);
  let widest = 0;
  for (const word of words) widest = Math.max(widest, ctx.measureText(word).width);
  return widest;
}

// Draw the caption as a stack of words in the top-left of the canvas.
// Returns the y just below the stack so callers can place other elements.
export function drawCaption(ctx, caption, W, H) {
  const words = String(caption || '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (!words.length) return 0;

  const margin = W * 0.045;
  const maxWidth = W * 0.86;
  // Start from a size scaled to the canvas and shrink until the widest
  // word fits the measure.
  let px = H * 0.155;
  while (px > 12 && stackWidth(ctx, words, px) > maxWidth) px *= 0.94;
  setDisplayFont(ctx, px);

  const lineHeight = px * 0.94;
  const keyline = Math.max(2, px * 0.075);
  let baseline = margin + px * 0.82;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  for (const word of words) {
    // Hard shadow first, then keyline, then the warm fill on top.
    ctx.fillStyle = SHADOW;
    ctx.fillText(word, margin + px * 0.045, baseline + px * 0.05);
    ctx.strokeStyle = KEYLINE;
    ctx.lineWidth = keyline * 2;
    ctx.strokeText(word, margin, baseline);
    ctx.fillStyle = warmFill(ctx, baseline - px * 0.82, px);
    ctx.fillText(word, margin, baseline);
    baseline += lineHeight;
  }
  ctx.restore();
  return baseline - lineHeight + px * 0.18;
}

// Draw text with manual letter spacing, centred on cx. Canvas has no
// portable letter-spacing on every engine version we target, so each
// glyph is placed by hand.
export function drawSpacedText(ctx, text, cx, baseline, spacing) {
  const chars = [...String(text)];
  if (!chars.length) return;
  let total = 0;
  const widths = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    total += w;
    return w;
  });
  total += spacing * (chars.length - 1);
  let cursor = cx - total / 2;
  const previousAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cursor, baseline);
    cursor += widths[i] + spacing;
  });
  ctx.textAlign = previousAlign;
}

// The subtitle: gold, letter-spaced, uppercase, on a dark band that runs
// the full width near the bottom of the cover.
export function drawSubtitleBand(ctx, subtitle, W, H) {
  const text = String(subtitle || '').toUpperCase().trim();
  if (!text) return;
  const bandH = H * 0.085;
  const bandY = H - bandH;

  ctx.save();
  ctx.fillStyle = 'rgba(14,7,16,0.88)';
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = '#ffb35c';
  ctx.fillRect(0, bandY, W, Math.max(2, H * 0.004));
  ctx.fillRect(0, bandY + bandH - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));

  let px = bandH * 0.46;
  ctx.font = `700 ${px}px ${SUBTITLE_FONT_STACK}`;
  const spacing = px * 0.42;
  const fits = () => {
    let total = spacing * (text.length - 1);
    for (const ch of text) total += ctx.measureText(ch).width;
    return total <= W * 0.9;
  };
  while (px > 10 && !fits()) {
    px *= 0.92;
    ctx.font = `700 ${px}px ${SUBTITLE_FONT_STACK}`;
  }
  ctx.fillStyle = '#f2c14e';
  ctx.textBaseline = 'alphabetic';
  drawSpacedText(ctx, text, W / 2, bandY + bandH * 0.66, spacing);
  ctx.restore();
}

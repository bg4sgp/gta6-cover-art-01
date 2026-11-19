// Caption lettering for Vice Panels covers.
//
// The caption is stacked word by word in the top-left corner, the way poster
// art stacks a title: heavy capitals with a dark keyline, a soft shadow, and
// a warm gradient running down the letterforms. Underneath sits the subtitle
// in wide-spaced gold capitals on a dark band. All of it is drawn with the
// browser's own heavy sans-serif -- no font file is bundled or copied from
// anywhere.

const TITLE_FONT_STACK = '"Arial Black", "Segoe UI", "Noto Sans", "Liberation Sans", sans-serif';

/** Splits a caption into the lines it will be stacked in: one word a line, at most three. */
export function captionLines(caption) {
  const words = caption.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  if (words.length <= 3) return words;
  const lines = [words[0], words[1], words.slice(2).join(' ')];
  return lines;
}

/** The font size at which the widest line fits inside maxWidth, capped by maxSize. */
function fitFontSize(ctx, lines, maxWidth, maxSize) {
  let size = maxSize;
  const setFont = () => {
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
  };
  setFont();
  const widest = Math.max(...lines.map((line) => ctx.measureText(line).width));
  if (widest > maxWidth) {
    size = Math.max(14, Math.floor((size * maxWidth) / widest));
    setFont();
  }
  return size;
}

/**
 * Draws the caption and subtitle in the top-left of a W x H cover.
 * Returns nothing; call it after the panels and the colour grade are down.
 */
export function drawTitleBlock(ctx, W, H, caption, subtitle) {
  const lines = captionLines(caption);
  if (lines.length === 0 && !subtitle.trim()) return;
  const marginX = W * 0.052;
  const topY = H * 0.045;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let cursorY = topY;
  if (lines.length > 0) {
    const maxSize = Math.min(W * 0.19, H * 0.13);
    const size = fitFontSize(ctx, lines, W * 0.66, maxSize);
    const lineHeight = size * 0.94;
    const fill = ctx.createLinearGradient(0, cursorY, 0, cursorY + lineHeight * lines.length);
    fill.addColorStop(0, '#ffffff');
    fill.addColorStop(0.55, '#ffeef8');
    fill.addColorStop(1, '#ffc7e3');
    ctx.font = `900 ${size}px ${TITLE_FONT_STACK}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#17100d';
    ctx.lineWidth = size * 0.17;
    ctx.shadowColor = 'rgba(10, 4, 20, 0.55)';
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.07;
    for (const line of lines) {
      ctx.strokeText(line, marginX, cursorY);
      ctx.fillStyle = fill;
      ctx.fillText(line, marginX, cursorY);
      cursorY += lineHeight;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    cursorY += size * 0.18;
  }
  const sub = subtitle.trim().toUpperCase();
  if (sub) {
    const subSize = Math.min(W * 0.045, H * 0.034);
    ctx.font = `700 ${subSize}px ${TITLE_FONT_STACK}`;
    try {
      ctx.letterSpacing = `${Math.round(subSize * 0.42)}px`;
    } catch {
      // Older engines have no canvas letterSpacing; the subtitle still reads fine.
    }
    const textWidth = ctx.measureText(sub).width + subSize * 0.42 * sub.length;
    const bandPad = subSize * 0.55;
    ctx.fillStyle = 'rgba(12, 6, 24, 0.94)';
    ctx.fillRect(marginX - bandPad * 0.4, cursorY - subSize * 0.28, textWidth + bandPad * 1.1, subSize * 1.62);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 5, 18, 0.9)';
    ctx.lineWidth = subSize * 0.14;
    ctx.strokeText(sub, marginX, cursorY);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(sub, marginX, cursorY);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // Nothing to reset where the property does not exist.
    }
  }
  ctx.restore();
}

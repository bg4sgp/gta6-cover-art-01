// Panel layouts and painted backdrop scenes for the Vice Panels cover maker.
//
// A layout is a list of rectangles in fractions of the cover's width and
// height, [x, y, w, h] per panel. Tall covers (square and portrait) share one
// set of tables, wide covers (landscape) use their own, so the collage keeps
// its balance at every export size. Panels with no photo in them are filled
// by the painters below: small procedural scenes of Leonida -- a sunset
// beach, a neon street, a pier, a skyline, palms and a speedway -- drawn with
// gradients and silhouettes so the cover already looks finished before the
// first photo is added.

export const LAYOUTS = {
  classic: {
    tall: [
      [0, 0, 0.625, 0.5],
      [0.625, 0, 0.375, 0.25],
      [0.625, 0.25, 0.375, 0.25],
      [0, 0.5, 0.34, 0.27],
      [0.34, 0.5, 0.33, 0.27],
      [0.67, 0.5, 0.33, 0.27],
      [0, 0.77, 1, 0.23],
    ],
    wide: [
      [0, 0, 0.46, 1],
      [0.46, 0, 0.27, 0.52],
      [0.73, 0, 0.27, 0.52],
      [0.46, 0.52, 0.27, 0.48],
      [0.73, 0.52, 0.27, 0.48],
    ],
  },
  hero: {
    tall: [
      [0, 0, 0.56, 1],
      [0.56, 0, 0.44, 0.34],
      [0.56, 0.34, 0.44, 0.33],
      [0.56, 0.67, 0.44, 0.33],
    ],
    wide: [
      [0, 0, 0.58, 1],
      [0.58, 0, 0.42, 0.5],
      [0.58, 0.5, 0.42, 0.5],
    ],
  },
  strips: {
    tall: [
      [0, 0, 1, 0.3],
      [0, 0.3, 1, 0.24],
      [0, 0.54, 1, 0.24],
      [0, 0.78, 1, 0.22],
    ],
    wide: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
};

export const SCENE_NAMES = ['beach', 'neon', 'pier', 'skyline', 'palms', 'speedway'];

export const SCENE_TITLES = {
  beach: 'Sunset beach',
  neon: 'Neon street',
  pier: 'The pier',
  skyline: 'Downtown dusk',
  palms: 'Palm shade',
  speedway: 'Speedway',
};

/** Deterministic little random generator, so a scene paints the same way every time. */
function seededRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/** A vertical gradient helper: stops is a list of [offset, colour]. */
function skyGradient(ctx, x, y, w, h, stops) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
}

/** A palm tree silhouette: a curved trunk and a crown of fronds, rooted at (bx, by). */
function palmTree(ctx, bx, by, height, lean, colour) {
  const topX = bx + lean * height;
  const topY = by - height;
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, height * 0.05);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + lean * height * 0.3, by - height * 0.6, topX, topY);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, height * 0.034);
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI * (1.06 + (i / 7) * 0.88);
    const reach = height * (0.36 + (i % 3) * 0.045);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const endX = topX + dirX * reach;
    const endY = topY + dirY * reach * 0.55 + reach * 0.3;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + dirX * reach * 0.5,
      topY + dirY * reach * 0.62,
      endX,
      endY,
    );
    ctx.stroke();
  }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(topX + side * height * 0.035, topY + height * 0.03, height * 0.032, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A low sports car in profile, nose pointing right, sitting on ground line gy. */
function sportsCar(ctx, cx, gy, width, colour) {
  const h = width * 0.26;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.5, gy);
  ctx.lineTo(cx - width * 0.48, gy - h * 0.42);
  ctx.quadraticCurveTo(cx - width * 0.3, gy - h * 0.58, cx - width * 0.16, gy - h * 0.6);
  ctx.quadraticCurveTo(cx - width * 0.05, gy - h * 0.84, cx + width * 0.12, gy - h * 0.82);
  ctx.quadraticCurveTo(cx + width * 0.3, gy - h * 0.78, cx + width * 0.38, gy - h * 0.55);
  ctx.quadraticCurveTo(cx + width * 0.5, gy - h * 0.48, cx + width * 0.5, gy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 205, 240, 0.55)';
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.12, gy - h * 0.62);
  ctx.quadraticCurveTo(cx - width * 0.02, gy - h * 0.79, cx + width * 0.1, gy - h * 0.77);
  ctx.quadraticCurveTo(cx + width * 0.19, gy - h * 0.75, cx + width * 0.24, gy - h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0a12';
  for (const wx of [cx - width * 0.3, cx + width * 0.3]) {
    ctx.beginPath();
    ctx.arc(wx, gy, width * 0.085, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A small airliner silhouette flying right at (px, py), sized by wing span s. */
function planeShape(ctx, px, py, s, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(px + s * 0.52, py);
  ctx.lineTo(px + s * 0.3, py - s * 0.07);
  ctx.lineTo(px - s * 0.28, py - s * 0.09);
  ctx.lineTo(px - s * 0.44, py - s * 0.3);
  ctx.lineTo(px - s * 0.52, py - s * 0.28);
  ctx.lineTo(px - s * 0.46, py - s * 0.02);
  ctx.lineTo(px - s * 0.3, py + s * 0.04);
  ctx.lineTo(px - s * 0.04, py + s * 0.32);
  ctx.lineTo(px + s * 0.07, py + s * 0.3);
  ctx.lineTo(px + s * 0.1, py + s * 0.05);
  ctx.lineTo(px + s * 0.32, py + s * 0.04);
  ctx.closePath();
  ctx.fill();
}

/** A sailboat silhouette: hull, mast and two sails, floating on water line wy. */
function sailboat(ctx, cx, wy, width, colour) {
  const h = width * 0.9;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.5, wy);
  ctx.lineTo(cx + width * 0.5, wy);
  ctx.lineTo(cx + width * 0.32, wy + h * 0.16);
  ctx.lineTo(cx - width * 0.32, wy + h * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, wy);
  ctx.lineTo(cx, wy - h);
  ctx.lineTo(cx + width * 0.34, wy - h * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.05, wy - h * 0.06);
  ctx.lineTo(cx - width * 0.05, wy - h * 0.78);
  ctx.lineTo(cx - width * 0.36, wy - h * 0.06);
  ctx.closePath();
  ctx.fill();
}

function paintBeach(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#ffcf4d'],
    [0.45, '#ff7e47'],
    [0.68, '#e83e8c'],
    [1, '#5b2a86'],
  ]);
  const sunX = x + w * 0.66;
  const sunY = y + h * 0.6;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, h * 0.5);
  glow.addColorStop(0, 'rgba(255, 244, 190, 0.9)');
  glow.addColorStop(1, 'rgba(255, 244, 190, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff3b0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, h * 0.17, 0, Math.PI * 2);
  ctx.fill();
  const seaTop = y + h * 0.64;
  skyGradient(ctx, x, seaTop, w, h - (seaTop - y), [
    [0, '#c94f7c'],
    [1, '#2b1055'],
  ]);
  ctx.fillStyle = 'rgba(255, 220, 150, 0.55)';
  const rand = seededRandom(7);
  for (let i = 0; i < 16; i++) {
    const ry = seaTop + rand() * (h * 0.3);
    const rw = w * (0.05 + rand() * 0.16) * (1 - (ry - seaTop) / h);
    ctx.fillRect(sunX - rw / 2 + (rand() - 0.5) * w * 0.08, ry, rw, Math.max(1.5, h * 0.012));
  }
  ctx.fillStyle = '#22102e';
  ctx.fillRect(x, y + h * 0.93, w, h * 0.07);
  palmTree(ctx, x + w * 0.1, y + h * 1.0, h * 0.52, 0.16, '#160a24');
  palmTree(ctx, x + w * 0.94, y + h * 1.0, h * 0.42, -0.2, '#160a24');
}

function paintNeon(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#050914'],
    [0.6, '#1b0f38'],
    [1, '#33105c'],
  ]);
  const rand = seededRandom(21);
  ctx.fillStyle = '#0d1230';
  for (let i = 0; i < 6; i++) {
    const bw = w * (0.1 + rand() * 0.1);
    const bh = h * (0.35 + rand() * 0.4);
    const bx = x + (i / 6) * w + rand() * w * 0.04;
    ctx.fillRect(bx, y + h * 0.72 - bh, bw, bh);
    ctx.fillStyle = 'rgba(255, 214, 106, 0.8)';
    for (let d = 0; d < 8; d++) {
      if (rand() > 0.5) ctx.fillRect(bx + rand() * bw * 0.8, y + h * 0.72 - bh + rand() * bh * 0.85, w * 0.016, w * 0.016);
    }
    ctx.fillStyle = '#0d1230';
  }
  const sign = (sx, sy, sw, sh, colour) => {
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = h * 0.05;
    ctx.lineWidth = Math.max(2, h * 0.014);
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, h * 0.03);
    ctx.stroke();
    ctx.restore();
  };
  sign(x + w * 0.08, y + h * 0.12, w * 0.3, h * 0.16, '#22d3ee');
  sign(x + w * 0.6, y + h * 0.2, w * 0.32, h * 0.13, '#ff4fd8');
  sign(x + w * 0.16, y + h * 0.36, w * 0.2, h * 0.11, '#ffd23f');
  const streetTop = y + h * 0.72;
  ctx.fillStyle = '#120b2a';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.32, streetTop);
  ctx.lineTo(x + w * 0.68, streetTop);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
  ctx.fillRect(x + w * 0.2, streetTop + h * 0.04, w * 0.02, h * 0.2);
  ctx.fillStyle = 'rgba(255, 79, 216, 0.35)';
  ctx.fillRect(x + w * 0.78, streetTop + h * 0.04, w * 0.02, h * 0.2);
  sportsCar(ctx, x + w * 0.5, y + h * 0.99, w * 0.4, '#05050d');
  ctx.save();
  ctx.fillStyle = '#ff2a3c';
  ctx.shadowColor = '#ff2a3c';
  ctx.shadowBlur = h * 0.06;
  ctx.fillRect(x + w * 0.36, y + h * 0.93, w * 0.07, h * 0.02);
  ctx.fillRect(x + w * 0.57, y + h * 0.93, w * 0.07, h * 0.02);
  ctx.restore();
}

function paintPier(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#ffe8c2'],
    [0.42, '#ffb37b'],
    [1, '#ff8c69'],
  ]);
  ctx.fillStyle = '#fff6da';
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y + h * 0.24, h * 0.1, 0, Math.PI * 2);
  ctx.fill();
  const seaTop = y + h * 0.44;
  skyGradient(ctx, x, seaTop, w, h - (seaTop - y), [
    [0, '#15919b'],
    [1, '#074f66'],
  ]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1, h * 0.008);
  const rand = seededRandom(4);
  for (let i = 0; i < 12; i++) {
    const ly = seaTop + rand() * h * 0.5;
    const lx = x + rand() * w * 0.85;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + w * (0.04 + rand() * 0.08), ly);
    ctx.stroke();
  }
  sailboat(ctx, x + w * 0.7, seaTop + h * 0.2, w * 0.24, '#12303e');
  const deckY = y + h * 0.62;
  ctx.fillStyle = '#2e1a12';
  ctx.fillRect(x, deckY, w, h * 0.045);
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(x + w * (0.05 + i * 0.15), deckY, w * 0.025, h * 0.3);
  }
  ctx.strokeStyle = '#2e1a12';
  ctx.lineWidth = Math.max(2, h * 0.014);
  ctx.beginPath();
  ctx.moveTo(x, deckY - h * 0.09);
  ctx.lineTo(x + w, deckY - h * 0.09);
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w * (0.03 + i * 0.12), deckY - h * 0.09);
    ctx.lineTo(x + w * (0.03 + i * 0.12), deckY);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20, 20, 30, 0.8)';
  ctx.lineWidth = Math.max(1.5, h * 0.01);
  for (const [bx, by, s] of [[0.55, 0.16, 0.05], [0.66, 0.11, 0.04], [0.48, 0.1, 0.035]]) {
    ctx.beginPath();
    ctx.arc(x + w * bx - w * s, y + h * by, w * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * bx + w * s, y + h * by, w * s, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
}

function paintSkyline(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#241047'],
    [0.55, '#7c2d6e'],
    [1, '#ff7e47'],
  ]);
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(x + w * 0.8, y + h * 0.62, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  planeShape(ctx, x + w * 0.3, y + h * 0.16, w * 0.2, '#1c0b33');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = Math.max(1, h * 0.008);
  ctx.beginPath();
  ctx.moveTo(x + w * 0.05, y + h * 0.2);
  ctx.lineTo(x + w * 0.18, y + h * 0.18);
  ctx.stroke();
  const rand = seededRandom(11);
  const base = y + h;
  let bx = x - w * 0.02;
  while (bx < x + w) {
    const bw = w * (0.09 + rand() * 0.12);
    const bh = h * (0.3 + rand() * 0.42);
    ctx.fillStyle = '#12081f';
    ctx.fillRect(bx, base - bh, bw, bh);
    ctx.fillStyle = 'rgba(255, 215, 106, 0.9)';
    const cols = Math.max(1, Math.floor(bw / (w * 0.035)));
    const rows = Math.max(2, Math.floor(bh / (h * 0.07)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() > 0.55) {
          ctx.fillRect(bx + w * 0.012 + c * w * 0.035, base - bh + h * 0.03 + r * h * 0.07, w * 0.016, h * 0.032);
        }
      }
    }
    bx += bw + w * 0.015;
  }
}

function paintPalms(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#fff3a0'],
    [0.5, '#ff9a5a'],
    [1, '#ff5e7a'],
  ]);
  const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.52, 0, x + w / 2, y + h * 0.52, h * 0.7);
  glow.addColorStop(0, 'rgba(255, 250, 210, 0.95)');
  glow.addColorStop(0.35, 'rgba(255, 220, 150, 0.45)');
  glow.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff8d6';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.52, h * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(146, 44, 92, 0.75)';
  ctx.fillRect(x, y + h * 0.8, w, h * 0.045);
  palmTree(ctx, x + w * 0.04, y + h * 1.02, h * 0.66, 0.3, '#0d281c');
  palmTree(ctx, x + w * 0.99, y + h * 1.02, h * 0.58, -0.34, '#0d281c');
  palmTree(ctx, x + w * 0.2, y + h * 1.02, h * 0.4, 0.12, '#123524');
}

function paintSpeedway(ctx, x, y, w, h) {
  skyGradient(ctx, x, y, w, h, [
    [0, '#2b1055'],
    [0.55, '#7c2d6e'],
    [1, '#b83a6e'],
  ]);
  ctx.fillStyle = '#170b30';
  const rand = seededRandom(3);
  let bx = x;
  while (bx < x + w) {
    const bw = w * (0.06 + rand() * 0.08);
    const bh = h * (0.1 + rand() * 0.14);
    ctx.fillRect(bx, y + h * 0.56 - bh, bw, bh);
    bx += bw + w * 0.01;
  }
  const vanishX = x + w / 2;
  const vanishY = y + h * 0.56;
  ctx.fillStyle = '#17121f';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y + h);
  ctx.lineTo(vanishX - w * 0.06, vanishY);
  ctx.lineTo(vanishX + w * 0.06, vanishY);
  ctx.lineTo(x + w * 1.1, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ff4fd8';
  ctx.lineWidth = Math.max(2, h * 0.012);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y + h);
  ctx.lineTo(vanishX - w * 0.06, vanishY);
  ctx.moveTo(x + w * 1.1, y + h);
  ctx.lineTo(vanishX + w * 0.06, vanishY);
  ctx.stroke();
  ctx.fillStyle = '#ffd23f';
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    const dy = vanishY + (h * 0.44) * (t * t + 0.12);
    const dw = w * 0.012 * (0.4 + t * 2.2);
    ctx.fillRect(vanishX - dw / 2, dy, dw, h * 0.05 * (0.3 + t));
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  for (let i = 0; i < 7; i++) {
    const sy = y + h * (0.6 + rand() * 0.3);
    ctx.fillRect(x + rand() * w * 0.2, sy, w * (0.1 + rand() * 0.2), Math.max(1, h * 0.006));
    ctx.fillRect(x + w * (0.65 + rand() * 0.2), sy, w * (0.1 + rand() * 0.2), Math.max(1, h * 0.006));
  }
  sportsCar(ctx, x + w / 2, y + h * 0.99, w * 0.56, '#07070f');
  const lampX = x + w * 0.76;
  const lampY = y + h * 0.9;
  const lamp = ctx.createRadialGradient(lampX, lampY, 0, lampX, lampY, w * 0.09);
  lamp.addColorStop(0, 'rgba(255, 244, 190, 0.85)');
  lamp.addColorStop(1, 'rgba(255, 244, 190, 0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(lampX - w * 0.09, lampY - w * 0.09, w * 0.18, w * 0.18);
}

const PAINTERS = {
  beach: paintBeach,
  neon: paintNeon,
  pier: paintPier,
  skyline: paintSkyline,
  palms: paintPalms,
  speedway: paintSpeedway,
};

/** Paints one named scene into the rectangle (x, y, w, h), clipped to it. */
export function paintScene(ctx, scene, x, y, w, h) {
  const painter = PAINTERS[scene] ?? paintBeach;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  painter(ctx, x, y, w, h);
  ctx.restore();
}

/**
 * The panel rectangles for a cover of W x H under a layout name, in pixels.
 * The collage sits inside a paper frame; every panel is inset by half a
 * gutter on each side, so neighbours sit one gutter apart.
 */
export function panelRects(layoutName, W, H) {
  const layout = LAYOUTS[layoutName] ?? LAYOUTS.classic;
  const table = H >= W ? layout.tall : layout.wide;
  const gutter = Math.max(6, Math.round(W * 0.011));
  const frame = gutter;
  const innerW = W - frame * 2;
  const innerH = H - frame * 2;
  return table.map(([fx, fy, fw, fh]) => ({
    x: frame + fx * innerW + gutter / 2,
    y: frame + fy * innerH + gutter / 2,
    w: fw * innerW - gutter,
    h: fh * innerH - gutter,
    fx, fy, fw, fh,
  }));
}

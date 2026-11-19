// Vice Panels editor: wires the controls to the cover renderer.
//
// The stage canvas always holds the cover at its full export resolution, so
// what you see is exactly what the PNG will hold. Photos live in a tray;
// clicking one fills the selected panel, and a photo can also be spread
// across every panel at once. A `?shot=` query hands control to ./shots.js,
// which sets up fixed scenes for the entry's screenshots instead.

import { renderCover, SIZES } from './cover.js';
import { panelRects, SCENE_NAMES } from './panels.js';
import { prepareShot } from './shots.js';

const stage = document.getElementById('stage');
const ctx = stage.getContext('2d');
const status = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const scenePick = document.getElementById('scenePick');
const zoomInput = document.getElementById('zoom');
const panelLabel = document.getElementById('panelLabel');
const tray = document.getElementById('tray');
const spreadToggle = document.getElementById('spread');
const exportBtn = document.getElementById('exportBtn');

const MAX_PANELS = 7;
const DEFAULT_PLAN = [
  { mode: 'photo', sample: 'pier' },
  { mode: 'scene', scene: 'skyline' },
  { mode: 'scene', scene: 'neon' },
  { mode: 'photo', sample: 'boulevard' },
  { mode: 'scene', scene: 'speedway' },
  { mode: 'scene', scene: 'palms' },
  { mode: 'scene', scene: 'beach' },
];

const state = {
  sizeKey: 'portrait',
  layout: 'classic',
  grade: 'sunset',
  caption: captionInput.value,
  subtitle: subtitleInput.value,
  spread: false,
  spreadImg: null,
  panels: Array.from({ length: MAX_PANELS }, (_, i) => ({
    mode: 'scene',
    scene: SCENE_NAMES[i % SCENE_NAMES.length],
    img: null,
    ox: 0,
    oy: 0,
    zoom: 1,
  })),
};

let selected = 0;
let lastRects = [];
const trayPhotos = [];

function say(message) {
  status.textContent = message;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function currentRects() {
  const { w, h } = SIZES[state.sizeKey];
  return panelRects(state.layout, w, h);
}

function redraw() {
  const { w, h } = SIZES[state.sizeKey];
  if (stage.width !== w || stage.height !== h) {
    stage.width = w;
    stage.height = h;
  }
  lastRects = renderCover(ctx, w, h, state);
  markSelectedPanel();
  panelLabel.textContent = state.spread
    ? 'One photo spread across every panel'
    : `Panel ${selected + 1} of ${lastRects.length}`;
}

function markSelectedPanel() {
  if (document.body.classList.contains('shot-cover') || state.spread) return;
  const rect = lastRects[selected];
  if (!rect) return;
  ctx.save();
  ctx.strokeStyle = '#2fd6f2';
  ctx.lineWidth = Math.max(3, stage.width * 0.004);
  ctx.setLineDash([stage.width * 0.02, stage.width * 0.012]);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function syncPanelControls() {
  const panel = state.panels[selected];
  scenePick.value = panel.scene;
  zoomInput.value = String(panel.zoom);
}

function addToTray(img, name) {
  const photo = { img, name };
  trayPhotos.push(photo);
  const button = document.createElement('button');
  button.type = 'button';
  button.title = name;
  const thumb = document.createElement('img');
  thumb.src = img.src;
  thumb.alt = name;
  button.appendChild(thumb);
  button.addEventListener('click', () => placePhoto(photo));
  tray.appendChild(button);
  return photo;
}

function placePhoto(photo) {
  if (state.spread) {
    state.spreadImg = photo.img;
    say(`"${photo.name}" now fills every panel.`);
  } else {
    const panel = state.panels[selected];
    panel.mode = 'photo';
    panel.img = photo.img;
    say(`"${photo.name}" fills panel ${selected + 1}. Drag it to reposition.`);
  }
  redraw();
}

/** Loads the two bundled sample photos and deals them into the default plan. */
async function loadDefaults() {
  const samples = {};
  for (const name of ['pier', 'boulevard']) {
    try {
      const img = await loadImage(`samples/${name}.jpg`);
      samples[name] = addToTray(img, `${name} (sample)`);
    } catch {
      // A missing sample just leaves its panels painted.
    }
  }
  DEFAULT_PLAN.forEach((step, i) => {
    const panel = state.panels[i];
    if (step.mode === 'photo' && samples[step.sample]) {
      panel.mode = 'photo';
      panel.img = samples[step.sample].img;
    } else if (step.mode === 'scene') {
      panel.mode = 'scene';
      panel.scene = step.scene;
    }
  });
  if (samples.pier) state.spreadImg = samples.pier.img;
  syncPanelControls();
  redraw();
}

document.getElementById('photoFiles').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  for (const file of files) {
    const img = await loadImage(URL.createObjectURL(file));
    const photo = addToTray(img, file.name);
    placePhoto(photo);
  }
  if (files.length) say(`${files.length} photo(s) added from your machine.`);
  event.target.value = '';
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});
document.getElementById('layoutPick').addEventListener('change', (event) => {
  state.layout = event.target.value;
  selected = 0;
  syncPanelControls();
  redraw();
});
document.getElementById('gradePick').addEventListener('change', (event) => {
  state.grade = event.target.value;
  redraw();
});
scenePick.addEventListener('change', () => {
  const panel = state.panels[selected];
  panel.mode = 'scene';
  panel.img = null;
  panel.scene = scenePick.value;
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[selected].zoom = Number(zoomInput.value);
  redraw();
});
spreadToggle.addEventListener('change', () => {
  state.spread = spreadToggle.checked;
  redraw();
});

for (const button of document.querySelectorAll('.size-btn')) {
  button.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    state.sizeKey = button.dataset.size;
    exportBtn.textContent = `Export PNG — ${SIZES[state.sizeKey].label}`;
    selected = 0;
    syncPanelControls();
    redraw();
  });
}

exportBtn.addEventListener('click', () => {
  const { w, h } = SIZES[state.sizeKey];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off.getContext('2d'), w, h, state);
  off.toBlob((blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vice-panels-${state.sizeKey}-${w}x${h}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    say(`Saved vice-panels-${state.sizeKey}-${w}x${h}.png`);
  }, 'image/png');
});

function stagePoint(event) {
  const box = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * stage.width,
    y: ((event.clientY - box.top) / box.height) * stage.height,
  };
}

let drag = null;
stage.addEventListener('pointerdown', (event) => {
  const point = stagePoint(event);
  const index = lastRects.findIndex(
    (r) => point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h,
  );
  if (index === -1) return;
  selected = index;
  syncPanelControls();
  drag = { x: point.x, y: point.y };
  stage.setPointerCapture(event.pointerId);
  redraw();
});
stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = stagePoint(event);
  const rect = lastRects[selected];
  const panel = state.panels[selected];
  if (rect && panel.mode === 'photo') {
    panel.ox = Math.max(-1, Math.min(1, panel.ox + ((point.x - drag.x) / rect.w) * 2));
    panel.oy = Math.max(-1, Math.min(1, panel.oy + ((point.y - drag.y) / rect.h) * 2));
  }
  drag = point;
  redraw();
});
stage.addEventListener('pointerup', () => {
  drag = null;
});
stage.addEventListener('wheel', (event) => {
  const panel = state.panels[selected];
  if (panel.mode !== 'photo') return;
  event.preventDefault();
  panel.zoom = Math.max(1, Math.min(3, panel.zoom * (event.deltaY < 0 ? 1.06 : 0.94)));
  zoomInput.value = String(panel.zoom);
  redraw();
}, { passive: false });

const studio = {
  state,
  redraw,
  loadDefaults,
  setCaption(text) {
    captionInput.value = text;
    state.caption = text;
  },
  setSubtitle(text) {
    subtitleInput.value = text;
    state.subtitle = text;
  },
  syncSizeButtons() {
    document.querySelectorAll('.size-btn').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.size === state.sizeKey);
    });
    exportBtn.textContent = `Export PNG — ${SIZES[state.sizeKey].label}`;
  },
};

const params = new URLSearchParams(location.search);
if (params.get('shot')) {
  prepareShot(params.get('shot'), params, studio);
} else {
  loadDefaults();
}

// main.js — the Vice Panels editor: wires the controls, the photo tray and
// the canvas gestures to the composition engine in cover.js.
//
// Photos never leave the machine: files are read with object URLs and the
// export is a PNG the browser downloads. No network requests anywhere.

import { composeCover, panelAt, SIZES, GRADES } from './cover.js';
import { SCENES, LAYOUT_NAMES, panelRects } from './panels.js';
import { parseShot, SAMPLE_URLS } from './shots.js';

const $ = (id) => document.getElementById(id);

const canvas = $('stage');
const ctx = canvas.getContext('2d');

let nextPhotoId = 1;
const photos = new Map(); // id -> { img, name }

const state = {
  size: 'landscape',
  layout: 'classic',
  grade: 'vice',
  caption: 'Vice Heat',
  subtitle: 'Leonida',
  spread: false,
  spreadPhoto: null,
  selected: 0,
  panels: defaultPanels('classic'),
};

function defaultPanels(layout) {
  const scenesByLayout = {
    classic: ['sunset-beach', 'pier', 'neon-street', 'skyline-dusk', 'speedway'],
    hero: ['sunset-beach', 'neon-street', 'palm-shade'],
    strips: ['skyline-dusk', 'sunset-beach', 'neon-street', 'speedway'],
  };
  return (scenesByLayout[layout] || scenesByLayout.classic).map((scene) => ({ kind: 'scene', scene }));
}

function photoById(id) {
  const entry = photos.get(id);
  return entry ? entry.img : null;
}

function currentRects() {
  const { w, h } = SIZES[state.size];
  return panelRects(state.layout, w, h);
}

function render(frame = true) {
  const { w, h } = SIZES[state.size];
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  composeCover(ctx, state, w, h, photoById, { frame, selected: state.selected });
  updatePanelNote();
}

function updatePanelNote() {
  const cell = state.panels[state.selected];
  const note = $('panel-note');
  if (!cell) {
    note.textContent = 'Pick a panel on the cover.';
    return;
  }
  note.textContent = cell.kind === 'photo'
    ? `Panel ${state.selected + 1}: your photo — drag on the cover to reposition, scroll to zoom.`
    : `Panel ${state.selected + 1}: painted scene “${sceneName(cell.scene)}”. Add a photo from the tray to replace it.`;
  $('zoom').value = String(Math.round(((cell.zoom || 1) - 1) * 100));
}

function sceneName(id) {
  const scene = SCENES.find((s) => s.id === id);
  return scene ? scene.name : id;
}

// --- photo tray -----------------------------------------------------------

function addPhoto(img, name) {
  const id = nextPhotoId++;
  photos.set(id, { img, name });
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'tray-photo';
  item.title = `${name} — click to place in the selected panel`;
  const thumb = document.createElement('img');
  thumb.src = img.src;
  thumb.alt = name;
  item.appendChild(thumb);
  item.addEventListener('click', () => placePhoto(id));
  $('tray').appendChild(item);
  return id;
}

function placePhoto(id) {
  if (state.spread) {
    state.spreadPhoto = id;
  } else {
    state.panels[state.selected] = { kind: 'photo', photo: id, zoom: 1, ox: 0, oy: 0 };
  }
  render();
}

function loadImageFromUrl(url, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(addPhoto(img, name));
    img.onerror = reject;
    img.src = url;
  });
}

$('files').addEventListener('change', (event) => {
  for (const file of event.target.files) {
    const url = URL.createObjectURL(file);
    loadImageFromUrl(url, file.name).catch(() => {});
  }
  event.target.value = '';
});

$('load-samples').addEventListener('click', async () => {
  await loadImageFromUrl(SAMPLE_URLS.boulevard, 'Sample: boulevard').catch(() => {});
  await loadImageFromUrl(SAMPLE_URLS.pier, 'Sample: pier').catch(() => {});
  render();
});

// --- controls ---------------------------------------------------------------

function bindSelect(id, key, after) {
  $(id).addEventListener('change', (event) => {
    state[key] = event.target.value;
    if (after) after();
    render();
  });
}

bindSelect('size', 'size');
bindSelect('grade', 'grade');
bindSelect('layout', 'layout', () => {
  const keep = state.panels;
  state.panels = defaultPanels(state.layout);
  // Keep photos the maker already placed, in order, over the new scenes.
  keep.filter((c) => c.kind === 'photo').forEach((cell, i) => {
    if (i < state.panels.length) state.panels[i] = cell;
  });
  state.selected = Math.min(state.selected, state.panels.length - 1);
});

$('caption').addEventListener('input', (event) => {
  state.caption = event.target.value;
  render();
});
$('subtitle').addEventListener('input', (event) => {
  state.subtitle = event.target.value;
  render();
});

$('scene-picker').addEventListener('click', (event) => {
  const button = event.target.closest('[data-scene]');
  if (!button) return;
  state.panels[state.selected] = { kind: 'scene', scene: button.dataset.scene };
  render();
});

$('spread').addEventListener('change', (event) => {
  state.spread = event.target.checked;
  if (state.spread && state.spreadPhoto == null && photos.size) {
    state.spreadPhoto = photos.keys().next().value;
  }
  render();
});

$('zoom').addEventListener('input', (event) => {
  const cell = state.panels[state.selected];
  if (cell) {
    cell.zoom = 1 + Number(event.target.value) / 100;
    render();
  }
});

$('clear-panel').addEventListener('click', () => {
  state.panels[state.selected] = { kind: 'scene', scene: 'sunset-beach' };
  render();
});

$('export').addEventListener('click', () => {
  render(false);
  const link = document.createElement('a');
  link.download = `vice-panels-${state.size}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  render(true);
});

// --- canvas gestures --------------------------------------------------------

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (canvas.width / box.width),
    y: (event.clientY - box.top) * (canvas.height / box.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const hit = panelAt(currentRects(), point.x, point.y);
  if (hit >= 0) state.selected = hit;
  const cell = state.panels[state.selected];
  drag = { x: point.x, y: point.y, cell, moved: false };
  canvas.setPointerCapture(event.pointerId);
  render();
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || !drag.cell) return;
  const point = canvasPoint(event);
  const dx = point.x - drag.x;
  const dy = point.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  if (drag.moved && (drag.cell.kind === 'photo' || state.spread)) {
    const rect = currentRects()[state.selected];
    drag.cell.ox = clamp((drag.cell.ox || 0) - dx / Math.max(40, rect.w * 0.6));
    drag.cell.oy = clamp((drag.cell.oy || 0) - dy / Math.max(40, rect.h * 0.6));
    drag.x = point.x;
    drag.y = point.y;
    render();
  }
});

canvas.addEventListener('pointerup', () => { drag = null; });

canvas.addEventListener('wheel', (event) => {
  const cell = state.panels[state.selected];
  if (!cell) return;
  event.preventDefault();
  cell.zoom = Math.max(1, Math.min(3, (cell.zoom || 1) * (event.deltaY < 0 ? 1.06 : 0.94)));
  render();
}, { passive: false });

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}

// --- scene picker buttons ---------------------------------------------------

for (const scene of SCENES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.scene = scene.id;
  button.textContent = scene.name;
  $('scene-picker').appendChild(button);
}

// --- shot modes ---------------------------------------------------------------

async function applyShot(shot) {
  if (!shot) return;
  for (const key of ['size', 'layout', 'grade', 'caption', 'subtitle']) {
    if (shot[key]) state[key] = shot[key];
  }
  if (shot.layout) state.panels = defaultPanels(state.layout);
  syncControls();

  if (shot.mode === 'editor' || shot.mode === 'cover') {
    const boulevard = await loadImageFromUrl(SAMPLE_URLS.boulevard, 'Sample: boulevard').catch(() => null);
    const pier = await loadImageFromUrl(SAMPLE_URLS.pier, 'Sample: pier').catch(() => null);
    if (boulevard != null && state.panels[0]) {
      state.panels[0] = { kind: 'photo', photo: boulevard, zoom: 1, ox: 0, oy: 0 };
    }
    if (pier != null && state.panels[1]) {
      state.panels[1] = { kind: 'photo', photo: pier, zoom: 1, ox: 0, oy: 0 };
    }
    state.selected = 0;
  }
  if (shot.mode === 'cover') {
    document.body.classList.add('shot-cover');
    render(false);
  } else {
    render(true);
  }
}

function syncControls() {
  $('size').value = state.size;
  $('layout').value = state.layout;
  $('grade').value = state.grade;
  $('caption').value = state.caption;
  $('subtitle').value = state.subtitle;
}

// Fill the layout select from the layout table so names stay in one place.
for (const [id, name] of Object.entries(LAYOUT_NAMES)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = name;
  $('layout').appendChild(option);
}
for (const [id, grade] of Object.entries(GRADES)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = grade.name;
  $('grade').appendChild(option);
}
for (const [id, size] of Object.entries(SIZES)) {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = size.name;
  $('size').appendChild(option);
}

syncControls();
applyShot(parseShot(location.search)).then(() => render(document.body.classList.contains('shot-cover') ? false : true));

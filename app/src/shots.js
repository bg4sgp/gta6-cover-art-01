// shots.js — reads the ?shot= query the screenshot list (shots.json)
// drives, so a headless capture can open the app straight onto a finished
// cover or a loaded editor without clicking through it.
//
//   ?shot=cover&size=portrait&grade=neon&caption=Neon%20Reign&subtitle=Vice%20City
//   ?shot=editor
//
// In cover mode the chrome hides itself (body.shot-cover) and the canvas
// fills the window at the export size named. In editor mode the two sample
// photos are loaded and placed, as if the maker had just added them.

export function parseShot(search) {
  const params = new URLSearchParams(search || '');
  const mode = params.get('shot');
  if (!mode) return null;
  const shot = { mode };
  for (const key of ['size', 'layout', 'grade', 'caption', 'subtitle']) {
    if (params.get(key)) shot[key] = params.get(key);
  }
  return shot;
}

// The sample photos bundled with the app, by the short names shots use.
export const SAMPLE_URLS = {
  pier: 'samples/pier.jpg',
  boulevard: 'samples/boulevard.jpg',
};

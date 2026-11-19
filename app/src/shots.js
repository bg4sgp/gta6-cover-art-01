// Fixed scenes for the entry's screenshots.
//
// ?shot=cover renders one exported cover alone on the page at its full
// export size; ?shot=editor shows the editor with the sample photos loaded.
// Query parameters size, layout, grade, caption and subtitle dress the scene.
// Once the cover is painted, window.__shotReady is set so the screenshot
// tooling knows the frame is final.

export async function prepareShot(shot, params, studio) {
  if (params.get('size')) studio.state.sizeKey = params.get('size');
  if (params.get('layout')) studio.state.layout = params.get('layout');
  if (params.get('grade')) studio.state.grade = params.get('grade');
  if (params.get('caption')) studio.setCaption(params.get('caption'));
  if (params.get('subtitle')) studio.setSubtitle(params.get('subtitle'));
  studio.syncSizeButtons();
  await studio.loadDefaults();
  if (shot === 'cover') document.body.classList.add('shot-cover');
  studio.redraw();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

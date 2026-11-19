# Vice Panels — Leonida Cover Studio

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/bg4sgp/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/bg4sgp/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn a photo of yours and a caption into GTA-style cover art: a multi-panel
poster collage with painted Leonida scenes, bold stacked-word lettering and a
sunset or neon colour grade, exported as a PNG in the sizes posts actually
use — 1080 × 1080, 1080 × 1350 and 1920 × 1080.

**How it works**

1. Add photos from your device (they are read locally and never uploaded),
   or start with the two bundled sample photos.
2. Click a panel on the cover, then click a photo to fill it — or paint one
   of six procedural Leonida scenes into it (sunset beach, neon street, the
   pier, skyline dusk, palm shade, speedway). Drag to reposition a photo,
   scroll or use the slider to zoom, or spread one photo across every panel.
3. Pick a layout (classic grid, hero panel, film strips), a colour grade
   (Vice sunset, Neon night, Leonida day), and edit the caption and the
   gold subtitle.
4. Export PNG. The preview is drawn at full export resolution, so what you
   see is the file you get.

Everything is original: no game logos, artwork or fonts. The lettering is
your system’s own heavy sans with a keyline, a hard shadow and a warm
gradient fill. The app is plain static files — no build step, no network
requests — so it runs offline from any static server.

## Run it

```sh
node serve.ts            # serves app/ at http://localhost:8080
```

or serve `app/` with any static file server and open `index.html`.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with the vendored make.fun library
(`vendor/makefun-app.ts`). The screenshots in `screenshots/` are rendered
by `tools/make_screenshots.py`, a Pillow implementation of the same panel
tables, scene geometry, colour grades and lettering rules as the canvas
code, because this build machine’s browser will not launch standalone.

## Layout of the repo

- `app/index.html`, `app/style.css` — the editor page and its chrome
- `app/src/panels.js` — collage layouts and the six painted scenes
- `app/src/cover.js` — composition engine: cover-fit photos, spread mode,
  grades, vignette, panel keylines
- `app/src/lettering.js` — stacked-word caption and the gold subtitle band
- `app/src/main.js` — editor wiring: tray, gestures, controls, PNG export
- `app/src/shots.js` — the `?shot=` modes driven by `shots.json`
- `app/samples/` — two sample photos made for make.fun, free to use

<sub>Entered on [make.fun](https://make.fun/?ref=ww39pck3&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

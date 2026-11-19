# gta6-cover-art-01 — Vice Panels

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/bg4sgp/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/bg4sgp/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice Panels — Leonida Cover Studio**: a web app that turns your photos and a caption into GTA-style cover art. Your photos fill the panels of a multi-panel collage — or one photo spreads across all of them — alongside painted Leonida scenes (sunset beach, neon street, the pier, downtown dusk, palm shade, speedway), a Vice sunset / neon night / Leonida day colour grade, and bold stacked caption lettering. Pick a panel, click a photo to fill it, drag to reposition, zoom to crop, edit the words, and export a PNG at 1080 × 1080, 1080 × 1350 or 1920 × 1080. The app is static files under `app/`, runs fully offline, and reads photos only on your own machine — nothing is uploaded. The design, lettering and artwork are original; no Rockstar logo, artwork or font is used.

## Run it

Try the app locally (any static server works; this one is bundled):

```sh
node serve.ts
# then open http://localhost:8080
```

Hand it in the way the grader does — copies `app/` and `screenshots/` to the output directory and writes `dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=ww39pck3&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>

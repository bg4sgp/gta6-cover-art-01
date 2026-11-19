// Vice Panels — Leonida Cover Studio: the hand-in program for
// gta6-cover-art-01 (Node 22, standard library only, no network).
//
// The app itself is the static site under app/ (open app/index.html in a
// desktop browser, offline). This program copies app/ and screenshots/
// into the output directory and writes dossier.json there with the
// vendored make.fun dossier library, byte for byte as the grader's own
// copy of the library would write it. It runs twice at grading and both
// runs must produce identical bytes, so nothing here depends on time,
// randomness or the environment beyond the output path.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });
}

// The gate's caps, passed to the library so an over-limit tree fails here
// first rather than at the scorer: dossier text capped at 160 KiB, at most
// 4 screenshots of at most 256 KiB each, app/ at most 993 entries and
// 48 MiB with no path over 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  app_max_files: 993,
  app_max_bytes: 50_331_648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);

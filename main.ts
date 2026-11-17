// VEILPOINT ARENA — a best-game-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads fully offline (game/index.html and its ES modules, three.js
// vendored as minified builds under game/vendor/). This program hands it in:
// it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library, under the scorer's own caps.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Copy the two payload trees (game/, screenshots/) from the repository into
// the output directory, creating the output side first. Nothing else in the
// repository is part of the entry the grader sees.
function copyEntryFiles(fromRoot: string, toRoot: string): void {
  mkdirSync(toRoot, { recursive: true });
  cpSync(join(fromRoot, 'game'), join(toRoot, 'game'), { recursive: true });
  mkdirSync(join(toRoot, 'screenshots'), { recursive: true });
  if (existsSync(join(fromRoot, 'screenshots'))) {
    cpSync(join(fromRoot, 'screenshots'), join(toRoot, 'screenshots'), { recursive: true });
  }
}

// Count files and bytes under a directory, for the hand-in summary below.
function measureTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = measureTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

copyEntryFiles(here, out);

// The scorer's own caps (from the kit's starter): only text_max_bytes shapes
// the dossier's bytes; the others refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line summary of the hand-in, so a local run shows what was written
// (the grader's runs ignore stdout; this is for the maker's own checks).
const gameMeasure = measureTree(join(out, 'game'));
const shotMeasure = measureTree(join(out, 'screenshots'));
console.log(
  `veilpoint-arena: game ${gameMeasure.files} files / ${gameMeasure.bytes} bytes, `
  + `screenshots ${shotMeasure.files} files / ${shotMeasure.bytes} bytes, `
  + `dossier ${dossier.length} bytes -> ${out}`,
);

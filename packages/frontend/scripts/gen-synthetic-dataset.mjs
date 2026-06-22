#!/usr/bin/env node
// Generates a synthetic jsPsych-style dataset for measuring the in-browser memory profile of the
// upload → validate → download pipeline (issue #95). Each file is one "subject": a JSON array of
// trials, where every trial carries a nested array column (`gaze_data`) — the eye-tracking-style
// payload that drives sidecar-CSV extraction and dominates memory, mirroring the real Tobii case.
//
// The output is reproducible from a seed, so the SAME input can be loaded on `main` and on the
// OPFS branch and the peak-heap numbers compared apples-to-apples.
//
// Usage:
//   node packages/frontend/scripts/gen-synthetic-dataset.mjs [options]
//
// Options (all optional; defaults in brackets):
//   --files N        number of subject files            [20]
//   --trials M       trials per file                    [400]
//   --gaze K         gaze samples (array items) / trial [200]
//   --out DIR        output directory   [./dev/synthetic-dataset]
//   --seed S         RNG seed for reproducible output    [1]
//
// Example — roughly the Tobii scale (~1.6M extracted rows, several hundred MB on disk):
//   node packages/frontend/scripts/gen-synthetic-dataset.mjs --files 20 --trials 400 --gaze 200

import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const defaults = { files: 20, trials: 400, gaze: 200, out: './dev/synthetic-dataset', seed: 1 };
  const opts = { ...defaults };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    const val = argv[i + 1];
    if (key === undefined || val === undefined) continue;
    if (key === 'out') opts.out = val;
    else if (key in opts) opts[key] = Number(val);
    else throw new Error(`Unknown option: --${key}`);
  }
  return opts;
}

// Mulberry32 — a tiny deterministic PRNG so a given seed always yields the same dataset.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STIMULI = ['mass', 'count', 'neutral', 'filler'];
const RESPONSES = ['f', 'j', 'left', 'right'];

function makeTrial(rng, trialIndex, timeElapsed, gazeLen) {
  const gaze_data = [];
  for (let s = 0; s < gazeLen; s++) {
    gaze_data.push({
      t: Math.round(rng() * 1000),
      x: +(rng() * 1920).toFixed(1),
      y: +(rng() * 1080).toFixed(1),
      validity: rng() > 0.05,
    });
  }
  return {
    trial_type: 'html-keyboard-response',
    trial_index: trialIndex,
    time_elapsed: timeElapsed,
    stimulus: STIMULI[Math.floor(rng() * STIMULI.length)],
    response: RESPONSES[Math.floor(rng() * RESPONSES.length)],
    rt: Math.round(200 + rng() * 1500),
    correct: rng() > 0.3,
    gaze_data,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(opts.out);
  const rng = mulberry32(opts.seed);

  // Fresh directory so stale files from a previous run don't skew the measurement.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let totalBytes = 0;
  for (let f = 0; f < opts.files; f++) {
    let timeElapsed = 0;
    const trials = [];
    for (let t = 0; t < opts.trials; t++) {
      timeElapsed += Math.round(300 + rng() * 1800);
      trials.push(makeTrial(rng, t, timeElapsed, opts.gaze));
    }
    const json = JSON.stringify(trials);
    totalBytes += Buffer.byteLength(json);
    const name = `subject-${String(f + 1).padStart(2, '0')}_data.json`;
    await writeFile(path.join(outDir, name), json);
  }

  const extractedRows = opts.files * opts.trials * opts.gaze;
  const fmtMB = (b) => (b / 1024 / 1024).toFixed(1);
  console.log(`Wrote ${opts.files} files to ${outDir}`);
  console.log(`  ${opts.trials} trials/file, ${opts.gaze} gaze samples/trial (seed ${opts.seed})`);
  console.log(`  ~${fmtMB(totalBytes)} MB on disk; ~${extractedRows.toLocaleString()} extracted gaze_data rows total`);
  console.log(`\nUpload this folder in the Data step to measure peak heap during validate/download.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

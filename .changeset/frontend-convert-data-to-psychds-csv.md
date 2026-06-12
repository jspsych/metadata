---
"@jspsych/metadata": minor
"frontend": minor
"@jspsych/metadata-cli": patch
---

Convert uploaded JSON data to Psych-DS CSV in the frontend so datasets validate instead of failing with `MISSING_DATAFILE`.

Previously the frontend placed uploaded jsPsych JSON files into `data/` unchanged, so the in-browser validator (and the downloadable zip) always failed — Psych-DS only recognises CSV/TSV datafiles whose names match its keyword pattern.

- `@jspsych/metadata` gains two shared, filesystem-agnostic helpers, `buildPsychDSDataFiles` and `deriveFallbackBase`, that turn a parsed data file (plus any extracted nested array/object columns) into its set of Psych-DS-named CSV outputs. Used by both the CLI and the frontend so the conversion lives in one place.
- The frontend's Data step now builds a converted `data/` payload during generation — a compliant main CSV, one sidecar per nested array/object column, and the original JSON preserved under `data/raw/` — and Review uses it for both validation and the zip. Auto-derived filenames use the official `subject` keyword (`subject-<stem>`) to avoid the unofficial-keyword warning.
- The CLI's non-rename-plan conversion path now delegates to the shared `buildPsychDSDataFiles`. No behaviour change.

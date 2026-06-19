---
"@jspsych/metadata": minor
"@jspsych/metadata-cli": patch
---

Accept jsPsych data exported as a `{ "trials": [...] }` wrapper (e.g. from OSF), not just a bare array. A new `unwrapTrials` helper (exported from `@jspsych/metadata`) unwraps the array when the input is exactly that single-key wrapper; every other JSON shape is returned unchanged, so `generate()` still throws on non-array input and the CLI/frontend still skip it. An object with sibling keys (`{ trials: [...], meta: {...} }`) is deliberately left untouched rather than silently discarding its top-level metadata.

`unwrapTrials` is folded into `parseJsonData`'s whole-document fast path, so every data parse site — `generate()`, the CLI directory pipeline, and the frontend uploader — accepts the wrapper through the one shared parser. A wrapped file is converted to a Psych-DS data CSV (with sidecars) and its literal wrapped original is still preserved under `data/raw/`. Previously such files were silently skipped ("0 files read").

---
"@jspsych/metadata-cli": patch
---

Create the output `data/` directory when updating an existing project that doesn't have one. When `--psych-ds-dir` points at a minimal or hand-rolled Psych-DS skeleton with no `data/` subdirectory, writing the first converted CSV failed with `ENOENT`, which surfaced opaquely as `x Data files was unsuccessful with 0 files read` and `MISSING_DATAFILE`/`MISSING_DATA_DIRECTORY`. `processDirectory` now ensures the target `data/` directory exists before writing (recursive, so it's a no-op when present). A brand-new project already got this from `createDirectoryWithStructure`; JSON inputs only dodged it incidentally by creating `data/raw/` first, so CSV-only existing projects were the ones that broke. Fixes #118.

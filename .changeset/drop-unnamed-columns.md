---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Drop unnamed columns so R-exported datasets validate. R's `write.csv` (with the default `row.names = TRUE`) prepends an unnamed row-index column, so the exported CSV header starts with a bare comma — an empty-string column name. Psych-DS variables require a name, so the column can never appear in `variableMeasured`; left in the on-disk CSV it fails validation with `CSV_COLUMN_MISSING_FROM_METADATA`.

The strip now lives in the shared data-file path so the CLI and frontend behave identically:

- `generate()` strips empty/whitespace-only columns from the parsed data up front, with a single warning instead of per-row spam (keeps `variableMeasured` clean and standalone library use safe), via a new exported `stripUnnamedColumns` helper.
- `buildPsychDSDataFiles` strips the main table before emitting it: a clean CSV keeps its exact bytes (verbatim `mainContent`), while a file with an unnamed column is re-serialised from the cleaned rows. Both the CLI (rename-plan and non-plan paths) and the frontend feed parsed `mainRows`, so the written/zipped/validated CSV always matches the metadata.

Fixes finding #2 of #109.

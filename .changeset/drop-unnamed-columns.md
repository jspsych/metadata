---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

Drop unnamed columns instead of producing a dataset that can't validate. R's `write.csv` (with the default `row.names = TRUE`) prepends an unnamed row-index column, so the exported CSV header starts with a bare comma — an empty-string column name. Psych-DS variables require a name, so the column could never appear in `variableMeasured`; the library previously skipped it (logging `Name field is missing. Variable not added.` once per row) while the CLI copied the CSV verbatim, leaving a column in the file with no metadata entry and failing validation with `CSV_COLUMN_MISSING_FROM_METADATA`.

`generate()` now strips empty/whitespace-only columns from the parsed data up front, with a single warning instead of per-row spam, via a new exported `stripUnnamedColumns` helper. The CLI mirrors this when writing data files: a `.csv` input that contains unnamed columns is re-serialised without them (column order preserved) so the on-disk file matches `variableMeasured`; well-formed CSVs are still copied byte-for-byte. Fixes finding #2 of #109.

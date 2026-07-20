---
"@jspsych/metadata-cli": minor
---

Eliminate silent failures and improve scriptability: prompt aborts no longer write to a literal `undefined/data` directory; invalid existing `dataset_description.json` or `--metadata-options` files now abort with a clear error instead of being silently overwritten/ignored; partial ingestion failures exit non-zero; validator crashes are reported as failures; the source `dataset_description.json` is no longer copied into `data/`; non-data files are skipped instead of counted as failures. New: `--version` flag, differentiated exit codes (0 success, 1 error/abort, 2 usage, 3 validation failure, 4 partial ingestion failure), docs link in `--help`. Importing the package no longer launches the interactive CLI. Redundant pre-pass parsing is skipped when no filenames need renaming.

---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

The CLI now writes a `.psychds-ignore` at the dataset root when it preserves raw jsPsych originals under `data/raw/`, so the validator no longer flags them as `FILE_NOT_CHECKED`. This mirrors the behavior the frontend already had.

The `.psychds-ignore` filename and content (`**/raw/` plus a self-reference, dictated by validator quirks) are now exported from `@jspsych/metadata` as `PSYCHDS_IGNORE_FILENAME` and `PSYCHDS_IGNORE_CONTENT`, so the CLI and frontend share one definition instead of duplicating the literal string.

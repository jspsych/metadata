---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
---

Handle jsPsych CSVs whose `stimulus` column is unquoted HTML containing literal `"` (e.g. `<div class = "EncodingBox">`), which violates strict RFC-4180 quoting. Such files were previously unreadable end to end.

- `parseCSV` now sets `relax_quotes: true`, so a row with an unescaped quote no longer throws `Invalid Opening Quote` and drops the whole file.
- A new `parseCSVForWrite` helper reports whether the content was already strictly valid CSV. The CLI and frontend use it so a clean file keeps its exact bytes (written verbatim), while a file that only parsed thanks to quote relaxation is re-serialised to well-formed CSV. Without this the malformed bytes were copied into the Psych-DS `data/` payload and the validator rejected them with `CSV_FORMATTING_ERROR`.

Net effect: datasets like this now ingest and pass Psych-DS validation through both the library/CLI and the browser uploader.

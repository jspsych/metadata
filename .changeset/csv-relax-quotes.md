---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Ingest jsPsych CSVs that violate strict RFC-4180 quoting — e.g. an unquoted `stimulus` column containing literal `"` (`<div class = "EncodingBox">`) or BOTH quotes and commas (`<p>Press "F", "J" to respond</p>`). Such files previously failed to parse and were dropped entirely ("0 files read").

- `parseCSV` now escalates leniency only as far as a file requires: strict RFC-4180 first (well-formed files are never reinterpreted), then csv-parse `relax_quotes` (unescaped quotes, no embedded commas), then a row-repair fallback that reassembles rows over-split by commas inside unquoted/improperly-quoted text (a comma followed by a space is treated as literal — machine-written delimiters never have one). A row that still can't be matched to the header is skipped with a warning; one bad row costs that row, not the file. Malformed files are parsed up to three times (clean files once) — a deliberate trade against the single-parse fast path.
- A new `parseCSVForWrite` helper reports whether the content was already strictly valid CSV (`verbatimSafe`). The CLI and frontend use it so a clean file keeps its exact bytes (written verbatim), while a file that only parsed leniently is re-serialised to well-formed CSV — and a console warning says so, since the original bytes were reinterpreted. Without this the malformed bytes were copied into the Psych-DS `data/` payload and the validator rejected them with `CSV_FORMATTING_ERROR`.

Net effect: datasets like OSF phxq4 (1258 files of unquoted stimulus HTML, many with embedded commas) now ingest and pass Psych-DS validation through both the library/CLI and the browser uploader.

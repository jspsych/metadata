---
"@jspsych/metadata": patch
"@jspsych/metadata-cli": patch
"frontend": patch
---

Accept JSON-Lines (JSONL) experiment data, not just a single JSON array. Several jsPsych labs — and JATOS exports — write data as newline-delimited JSON, with one JSON value per line (typically one participant's full trial array per line) rather than one big array. Previously `generate()` ran `JSON.parse` on the whole string, so every such file failed with `Unexpected non-whitespace character after JSON` and produced no metadata.

A new exported `parseJsonData` helper handles both shapes: a well-formed single document is returned unchanged (no behaviour change for existing single-array callers), and only when whole-string parsing fails does it fall back to parsing line by line, flattening any per-line arrays into one observation stream. It is now used wherever JSON data files are parsed:

- `generate()` (the library) for the main ingestion path.
- the CLI's data-file reader, join-key pre-pass, and CSV-conversion path.
- the frontend's join-key pre-flight and Psych-DS file builder.

The `.jsonl` file extension is now also recognised as a JSON data file (these exports are conventionally named `.jsonl`). The CLI processes `.jsonl` exactly like `.json` — including filename-normalization, raw-original preservation, and CSV conversion — and the frontend normalises a `.jsonl` upload to the JSON path.

Verified end to end against the raw `.jsonl` exports in `vucml/online_experiments`: all 15 files now generate metadata and pass the Psych-DS validator with zero errors (they failed at parse time before).

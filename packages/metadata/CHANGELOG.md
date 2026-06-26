# @jspsych/metadata

## 0.1.0

### Minor Changes

- 0f4cc4a: Recursively expand nested JSON objects more than one level deep. Previously `expandObjectFields` only expanded a single level, so a value like `response: {"Q0":{"score":4,"meta":{"valid":true}}}` registered `response.Q0` as an opaque `value:"object"` leaf and lost its sub-fields. Now nested plain objects are fully expanded into dotted sub-variables (`response.Q0.score`, `response.Q0.meta.valid`) with correct types and min/max/levels tracking at any depth. Arrays nested inside objects are now correctly typed as `value:"array"` instead of `"object"`, and nested arrays-of-objects are extracted into their own Psych-DS CSV files keyed by their dotted column name — mirroring how top-level array columns are handled.
- a5af08c: Detect and expand JSON-serialized nested columns in `generate()`. Flat JSON objects (e.g. `response: {"Q0":4,"Q1":3}`) are expanded into dotted sub-variables (`response.Q0`, `response.Q1`) in `variableMeasured` with correct types and min/max tracking. JSON arrays of objects are extracted into separate Psych-DS compliant CSV files (`{stem}_measure-{col}_data.csv`) with `trial_index` and `element_index` as join keys.
- aab8da8: Extract plain (non-array) object columns into separate Psych-DS CSV files so their expanded sub-variables resolve to real columns. `expandObjectFields` registers dotted sub-variables for object columns (e.g. `response.cb_1`, `calibration_data.type`), but those names previously had no corresponding CSV column, so Psych-DS validation reported `VARIABLE_MISSING_FROM_CSV_COLUMNS` for every one. Object columns are now accumulated into a new `extractedObjects` map (exposed via `getExtractedObjects()`) as one row per trial, and the CLI writes a per-file sidecar CSV (`{stem}_measure-{col}_data.csv`) — mirroring the existing array-of-objects extraction. The row is threaded through the recursive expansion so a column is recorded for every registered descendant (leaf scalars, intermediate object nodes, and nested-array parents), and it reuses the same configurable `arrayJoinKeys` (one row per trial, no `element_index`).
- 35de4b6: Extract arrays of primitives into sidecar CSVs so their elements become real, typed variables. Previously an array of numbers or strings (`block_order: [16,100,4,1]`, `images: [...]`) was recorded only as a single `value:"array"` column with no per-element detail. Such arrays are now extracted like arrays-of-objects, but — since primitives have no field name — each element is recorded under a synthetic `<column>.value` column (distinct from the array parent, which stays `value:"array"`). The element variable gets its proper type with `minValue`/`maxValue` (numeric) or `levels` (string), joinable to its row via the existing join keys + `element_index`. This composes with the nested-array recursion (an array of arrays of numbers yields a grandchild table with a `.value` column) and completes Psych-DS round-tripping for all four cell shapes: scalar, object, array-of-objects, and array-of-primitives.

  Tradeoff: every non-empty primitive-array column now produces its own sidecar CSV, so datasets with many such columns generate substantially more files (e.g. one eye-tracking export grew from 304 to 380 data files). Extraction is the default and there is no new prompt. A future opt-in `primitiveArrayMode: "extract" | "summarize"` could offer an in-place summary alternative, but is intentionally not added here to avoid complicating the CLI flow.

- 585d337: Convert uploaded JSON data to Psych-DS CSV in the frontend so datasets validate instead of failing with `MISSING_DATAFILE`.

  Previously the frontend placed uploaded jsPsych JSON files into `data/` unchanged, so the in-browser validator (and the downloadable zip) always failed — Psych-DS only recognises CSV/TSV datafiles whose names match its keyword pattern.

  - `@jspsych/metadata` gains two shared, filesystem-agnostic helpers, `buildPsychDSDataFiles` and `deriveFallbackBase`, that turn a parsed data file (plus any extracted nested array/object columns) into its set of Psych-DS-named CSV outputs. Used by both the CLI and the frontend so the conversion lives in one place.
  - The frontend's Data step now builds a converted `data/` payload during generation — a compliant main CSV, one sidecar per nested array/object column, and the original JSON preserved under `data/raw/` — and Review uses it for both validation and the zip. Auto-derived filenames use the official `subject` keyword (`subject-<stem>`) to avoid the unofficial-keyword warning, and a `.psychds-ignore` is emitted so the preserved `data/raw/` originals don't surface as `FILE_NOT_CHECKED`.
  - The CLI's non-rename-plan conversion path now delegates to the shared `buildPsychDSDataFiles`. No behaviour change.

- 6b0d1d4: Export Psych-DS utility functions from the core package: `isValidPsychDSDataFilename`, `toPsychDSValue`, `deriveArrayFilename`, `objectsToCSV`, `disambiguateArrayFilename`. Previously these lived only in the CLI. Moving them to core makes them available to any downstream consumer (e.g. the frontend) and ensures the CLI and any future tools share a single implementation.

  The CLI now imports these functions from `@jspsych/metadata` instead of defining them locally. No behaviour change.

- d9e4485: Recursively unnest nested data inside extracted array elements. Previously an array-of-objects column was extracted one level deep, so an element field that was itself an object (`pointData.point`) or an array (`pointData.gazeSamples`) was kept as a single opaque JSON column. Now element fields recurse: a nested plain object is expanded into deeper dotted columns in the same sidecar row (`pointData.point.x`, `pointData.point.y`), and a nested array-of-objects is extracted into its own grandchild CSV (`..._measure-...GazeSamples_data.csv`). Grandchild tables remain joinable to their specific parent element via a qualified `<column>.element_index` key carried alongside the existing join keys (e.g. `trial_index` + `validation_data.pointData.element_index` + the grandchild's own `element_index`), and every such key/column is registered in `variableMeasured`. This completes Psych-DS round-tripping for arbitrarily nested object/array data — arrays nested inside arrays inside objects now fully expand instead of bottoming out as JSON.
- 5fcce14: Register array-of-objects element fields in `variableMeasured` so extracted sidecar CSVs have no undeclared columns. Previously `accumulateArrayColumn` wrote each element's fields as bare columns (e.g. `x`, `y`) plus `element_index` into the extracted-array CSV, but never added them to `variableMeasured`, so Psych-DS validation reported `CSV_COLUMN_MISSING_FROM_METADATA`. Element fields are now emitted under dotted names (`tobii_data.x`, `validation_data.pointData.point`) — avoiding collisions between same-named fields of different array columns — and each is registered with its correct type and min/max/levels tracking. `element_index` is registered once. Object- and array-valued element fields are recorded one level deep (a single dotted JSON column, `value:"object"`/`"array"`); they are not further expanded or extracted. This is the array-side counterpart to the plain-object sidecar fix and completes Psych-DS column/variable round-tripping for nested data.
- 31c5ba9: Accept jsPsych data exported as a `{ "trials": [...] }` wrapper (e.g. from OSF), not just a bare array. A new `unwrapTrials` helper (exported from `@jspsych/metadata`) unwraps the array when the input is exactly that single-key wrapper; every other JSON shape is returned unchanged, so `generate()` still throws on non-array input and the CLI/frontend still skip it. An object with sibling keys (`{ trials: [...], meta: {...} }`) is deliberately left untouched rather than silently discarding its top-level metadata.

  `unwrapTrials` is folded into `parseJsonData`'s whole-document fast path, so every data parse site — `generate()`, the CLI directory pipeline, and the frontend uploader — accepts the wrapper through the one shared parser. A wrapped file is converted to a Psych-DS data CSV (with sidecars) and its literal wrapped original is still preserved under `data/raw/`. Previously such files were silently skipped ("0 files read").

### Patch Changes

- 8731c30: Boolean variables no longer record `levels`. Genuine boolean values (`typeof === "boolean"`) are typed `value:"boolean"` with no `levels`/`minValue`/`maxValue`, and string `"true"`/`"false"` values are kept as strings so they surface as `levels: ["true","false"]` (no longer coerced to boolean). A manual `value:"boolean"` override now drops any detected levels and warns when the detected values don't map cleanly to true/false (anything other than `true`/`false`/`0`/`1`). This also fixes a bug where raw booleans were pushed into the `levels` array, producing inconsistent `[false]`/empty output.
- 585d337: The CLI now writes a `.psychds-ignore` at the dataset root when it preserves raw jsPsych originals under `data/raw/`, so the validator no longer flags them as `FILE_NOT_CHECKED`. This mirrors the behavior the frontend already had.

  The `.psychds-ignore` filename and content (`**/raw/` plus a self-reference, dictated by validator quirks) are now exported from `@jspsych/metadata` as `PSYCHDS_IGNORE_FILENAME` and `PSYCHDS_IGNORE_CONTENT`, so the CLI and frontend share one definition instead of duplicating the literal string.

- f96e1e6: Add tests verifying variableMeasured completeness for CSV input. Covers always-empty columns, null-string columns, partially-empty columns, and sparse multi-trial-type CSVs where different trial types populate different columns.
- ed9c25c: Fix stray empty-string expression in parseCSV and remove stale tsconfig paths entry for csv-parse/browser/esm (was pointing to a non-existent path in the installed csv-parse version).
- 0eeb9a2: fix(metadata,cli): strip a leading UTF-8 BOM from CSV and JSON input

  CSVs exported by Excel (and similar tools) begin with a UTF-8 BOM (U+FEFF).
  The shared `parseCSV` previously folded that BOM into the first header,
  producing a corrupted variable name like `﻿Participant_ID` that is not valid
  Psych-DS. `parseCSV` now passes `bom: true` to `csv-parse`, and `parseJsonData`
  strips the same BOM before parsing, so the first variable is named exactly as
  written (e.g. `Participant_ID`) and BOM-prefixed JSON/JSON-Lines no longer fail
  to parse (which previously, for inputs with nested-array columns, could abort an
  interactive run with a rename-plan mismatch).

  The CLI also strips a leading BOM from the file content before writing the
  data file into the Psych-DS `data/` directory. A clean CSV is written
  verbatim, so without this the persisted file would keep a BOM-prefixed first
  column that no longer matches the BOM-stripped variable name in the metadata,
  failing validation with `CSV_COLUMN_MISSING_FROM_METADATA` and
  `VARIABLE_MISSING_FROM_CSV_COLUMNS`. Surfaced by the OSF lip-kinematics
  validation dataset (osf.io/9v4t6).

- 1511d20: `variableMeasured.description` is now always serialized as a single schema.org Text value. When a column accumulated genuinely different descriptions from multiple plugins, `getList()` previously emitted `description` as an object (`{ pluginType: text }`), which made the Psych-DS validator raise an `OBJECT_TYPE_MISSING` warning. The distinct descriptions are now joined into one string with `" | "`. `getList()` is also idempotent now (a second call no longer mangles an already-collapsed string description), and empty descriptions collapse to `"unknown"`.
- 8edc7c2: Drop unnamed columns so R-exported datasets validate. R's `write.csv` (with the default `row.names = TRUE`) prepends an unnamed row-index column, so the exported CSV header starts with a bare comma — an empty-string column name. Psych-DS variables require a name, so the column can never appear in `variableMeasured`; left in the on-disk CSV it fails validation with `CSV_COLUMN_MISSING_FROM_METADATA`.

  The strip now lives in the shared data-file path so the CLI and frontend behave identically:

  - `generate()` strips empty/whitespace-only columns from the parsed data up front, with a single warning instead of per-row spam (keeps `variableMeasured` clean and standalone library use safe), via a new exported `stripUnnamedColumns` helper.
  - `buildPsychDSDataFiles` strips the main table before emitting it: a clean CSV keeps its exact bytes (verbatim `mainContent`), while a file with an unnamed column is re-serialised from the cleaned rows. Both the CLI (rename-plan and non-plan paths) and the frontend feed parsed `mainRows`, so the written/zipped/validated CSV always matches the metadata.

  Fixes finding #2 of #109.

- e80e57c: Fix always-empty columns being silently dropped from variableMeasured. Columns whose values are null or empty across all rows in a dataset now appear in variableMeasured with a minimal `"value": "unknown"` entry, satisfying the Psych-DS requirement that every CSV column header has a corresponding entry.
- 06a84fb: fix(metadata): make the Node ESM entry (`dist/index.js`) loadable

  The build runs esbuild (which emits the bundled `dist/index.js`) followed by
  `tsc`. With `declaration: true` and `outDir: ./dist` but no `emitDeclarationOnly`,
  `tsc` re-emitted an unbundled `dist/index.js` over esbuild's bundle, leaving
  extensionless relative imports (e.g. `./utils`) that Node's ESM loader rejects.
  Added `emitDeclarationOnly: true` so `tsc` emits only the `.d.ts` declarations and
  esbuild's working bundle survives; type-checking and `dist/index.d.ts` are unchanged.

- 03a3ce4: fix(metadata): preserve string descriptions and primitive column types across generate() calls

  Two related bugs fixed in metadata generation:

  1. **String descriptions wiped on re-generate** — `VariablesMap.updateDescription` previously
     replaced any non-object description with `{}` before merging, discarding user-written
     descriptions loaded from an existing `dataset_description.json`. Non-object descriptions
     are now promoted to `{ default: string }` so they survive subsequent `generate()` calls.

  2. **Mixed-type column typed as "array" instead of "string"** — When a column's rows contain
     a mix of primitive values and arrays/objects (e.g. a `response` column with keyboard-trial
     strings and survey-trial objects), later rows previously overwrote the column type to
     `"array"`. The array-type override now only fires when the existing type is not already a
     concrete primitive (`"string"`, `"number"`, or `"boolean"`).

- ae0d01c: fix(metadata): treat mixed-type columns as categorical, not numeric+categorical

  A column containing both numeric and non-numeric values previously produced
  contradictory metadata: `value: "number"` alongside both `minValue`/`maxValue`
  and `levels`. The fix decides at the cell level — once a non-numeric value
  arrives in a column that had numeric min/max (or vice versa), the column is
  downgraded to categorical: min/max fields are removed, boundary values are
  preserved as string levels, and a `console.warn` is emitted once per column.

- c2426be: Fix `PluginCache` parsing errors for standard and custom jsPsych plugins. The data block was extracted with a lazy regex that overshot into the rest of the info object; replaced with brace-counting extraction that handles any nesting depth. Non-ok HTTP responses (e.g. 404 for unknown plugins) are now caught before reaching the parser rather than passing HTML error pages as source code. Additionally, JSDoc descriptions for parameters inside a `nested:` sub-object (e.g. `view_history`'s `page_index` and `viewing_time` in `jsPsych-instructions`) are now correctly extracted; previously the first nested parameter was silently consumed by the parent variable's regex match and never added to the cache.
- e1cb44e: Fix whitespace-only string values being misdetected as numeric (#70). A cell containing only whitespace (e.g. a single space) passed the `isNaN(Number(value))` check because `Number(" ")` is `0`, but `parseFloat(" ")` is `NaN` — leaking through as `NaN` `minValue`/`maxValue` (serialized to `null`) on otherwise-categorical string columns. The numeric check now requires non-empty trimmed content and uses `Number` for both the test and the conversion so they cannot disagree.
- 1e63ba6: Don't propose unnamed/whitespace-only-header columns as join keys. R's `write.csv` (default `row.names = TRUE`) prepends an unnamed row-index column (empty-string header) that is unique per row, so `analyzeJoinKeys` would offer it as a join-key candidate — and the headless resolver (`resolveJoinKeysNonInteractive`), picking the lexicographically-first sufficient column, could choose it (logging a confusing `added ""`). But `stripUnnamedColumns` (#114) drops that column from the written output, so the chosen key would then vanish from the extracted sidecar. `analyzeJoinKeys` now excludes empty/whitespace-only-header columns from candidate selection (the same predicate `stripUnnamedColumns` uses), so the resolver, the interactive prompt, and the frontend join-key chooser never propose a column that can't survive to the output. Fixes #117.
- 3c7d1f7: Accept JSON-Lines (JSONL) experiment data, not just a single JSON array. Several jsPsych labs — and JATOS exports — write data as newline-delimited JSON, with one JSON value per line (typically one participant's full trial array per line) rather than one big array. Previously `generate()` ran `JSON.parse` on the whole string, so every such file failed with `Unexpected non-whitespace character after JSON` and produced no metadata.

  A new exported `parseJsonData` helper handles both shapes: a well-formed single document is returned unchanged (no behaviour change for existing single-array callers), and only when whole-string parsing fails does it fall back to parsing line by line, flattening any per-line arrays into one observation stream. It is now used wherever JSON data files are parsed:

  - `generate()` (the library) for the main ingestion path.
  - the CLI's data-file reader, join-key pre-pass, and CSV-conversion path.
  - the frontend's join-key pre-flight and Psych-DS file builder.

  The `.jsonl` file extension is now also recognised as a JSON data file (these exports are conventionally named `.jsonl`). The CLI processes `.jsonl` exactly like `.json` — including filename-normalization, raw-original preservation, and CSV conversion — and the frontend normalises a `.jsonl` upload to the JSON path.

  Verified end to end against the raw `.jsonl` exports in `vucml/online_experiments`: all 15 files now generate metadata and pass the Psych-DS validator with zero errors (they failed at parse time before).

- 3c7d1f7: Synthesize a `source_record_id` join key for multi-record JSON-Lines exports. Raw jsPsych exports carry no per-row identifier, so once JSONL is flattened (one record per line) `trial_index` repeats across records and can't uniquely key the extracted array/object sidecar CSVs — every record's trial 0 collapsed onto the same `(trial_index, element_index)` key, making the sidecars impossible to join back to a single parent trial.

  The synthesized column is named `source_record_id` rather than `participant_id` because a JSON-Lines line is only guaranteed to be one _source record_ — usually, but not always, one participant. The honest name avoids overclaiming for exports where a line isn't a single subject.

  `parseJsonData` now takes an opt-in `{ tagSourceRecordId }` flag: in the JSON-Lines path it stamps each line's object rows with a 0-based `source_record_id` (a no-op on the single-array fast path), and reports via an optional `stats` out-param whether it actually synthesized the id. A line that already carries a `source_record_id` or a real `participant_id` is left untouched — the experiment's own identifier already groups those rows. `generate()` enables this for JSON input and promotes the identifier to the leading join key, preferring the synthesized `source_record_id` and falling back to a real `participant_id` already present in the export (`['source_record_id', 'trial_index']` or `['participant_id', 'trial_index']`), so the sidecars join unambiguously. CSV inputs are unaffected.

  When — and only when — the id was actually synthesized (i.e. absent from the source), it is given an explicit description that makes its synthetic origin unmistakable ("Synthetic source-record identifier … NOT a real subject ID from the experiment …") so a downstream user can't mistake it for a real subject ID; this also avoids serializing an empty `{}` description (an object with no `@type`, which trips the validator's `OBJECT_TYPE_MISSING`). The CLI's join-key pre-analysis/prompt and the frontend's pre-flight mirror this promotion so multi-record JSONL is no longer falsely flagged as having a non-unique join key.

  Verified end to end against the raw `.jsonl` exports in `vucml/online_experiments` (`block_cat`): the combined 30-record export generates metadata, passes the Psych-DS validator (0 errors), synthesizes `source_record_id` 0–29, and writes sidecars whose `(source_record_id, trial_index, element_index)` keys are fully unique — including the doubly-nested `recall_responses` case. Notably `subjectId` collides across the two merged datasets (two records share `601`), which `source_record_id` correctly keeps distinct.

- 72f8a4b: Register jsPsych system variables (`trial_type`, `trial_index`, `time_elapsed`, `extension_type`, `extension_version`) lazily instead of seeding them in the `VariablesMap` constructor. They now appear in `variableMeasured` only when their column is actually present in the data. Previously `time_elapsed` (and the others) were always emitted, so any dataset whose CSVs omit `time_elapsed` — common for processed/aggregated jsPsych exports — failed Psych-DS validation with `VARIABLE_MISSING_FROM_CSV_COLUMNS`. Datasets that do contain these columns are unaffected.

  This also removes the eager `generateDefaultExtensionVariables()` seeding path, which registered both `extension_type` and `extension_version` whenever `extension_type` was observed — orphaning `extension_version` for any dataset that lacked that column. The extension variables now register lazily per-column like the other system variables.

- ca8dc75: Extend the stress-test regression guards with three more Jest suites covering the CSV ingestion path, generation at scale, and cross-file output-name collisions.

  - `@jspsych/metadata` — `csv-input.stress`: pins how `generate(data, {}, "csv")` re-infers types from string cells (numeric coercion incl. whitespace/scientific-notation/`Infinity`/`NaN` rejection, mixed-column downgrade, `"true"`/`"false"` staying categorical, RFC-4180 quoting, unicode, empty/literal-`null` cells, the 50-char level cap, JSON-in-a-cell extraction), and asserts CSV/JSON parity for unambiguously-typed columns.
  - `@jspsych/metadata` — `scale.stress`: feeds a 5,000-row dataset and checks exact numeric extremes, categorical dedup, high-cardinality level accumulation, boolean handling, and a throughput ceiling that guards against accidental O(n²) regressions.
  - `@jspsych/metadata-cli` — `array-collision.stress`: two same-stem files in different subdirectories sharing a nested array column, asserting `processDirectory` disambiguates every main CSV, sidecar, and preserved raw original (no overwrites, all still Psych-DS compliant) — the cross-file collision gap left by the earlier rename suite.

  Test-only change; no library or CLI behavior is modified.

- 26c5fc0: Parse each data file once instead of twice. `JsPsychMetadata.generate()` now accepts data that is already a parsed array of observations (not just a JSON/CSV string); when given an array it skips parsing, and the caller can pass `synthesizedSourceRecordId` so the synthetic-id description is still applied. The CLI's `processDirectory`/`processFile` now parse a file a single time and hand the rows to `generate()` and to the Psych-DS CSV builder, rather than parsing once for metadata and again for conversion. No change to generated metadata or output files; this reduces CPU and peak memory on large datasets (e.g. multi-MB jsPsych/Tobii exports). Spun out of #95.
- fa17a9e: Add stress-test regression guards to the automated suite so previously-fixed nested-data and filename-normalization behavior can't silently regress.

  Four Jest suites, ported from the standalone `stress-tests/` harnesses so they run under plain `npm test` (and CI) without a build step:

  - `@jspsych/metadata`: `generate()` coherence over a comprehensive nested-data fixture (deep objects, arrays of objects/arrays, mixed-type columns, a `trial_type`-less row, unicode, empties), plus the Psych-DS filename-normalization helper invariants.
  - `@jspsych/metadata-cli`: the `processDirectory` conversion end-to-end (compliant main CSV, `data/raw/` preservation, two-way `variableMeasured` ↔ CSV-column cross-check, and a best-effort Psych-DS validation pass), plus the refusal to write a non-compliant filename non-interactively.

  Test-only change; no library or CLI behavior is modified. The shared fixture lives at `dev/stress/`.

- 55f2f91: Strip JSDoc continuation `*` markers when parsing multi-line plugin/extension variable descriptions, so descriptions like the webgazer extension's `webgazer_data` no longer contain stray asterisks. Adds a regression test for webgazer-shaped multi-line JSDoc.

## 0.0.3

### Patch Changes

- 974243d: Updating frontend to be more user-friendly with major edits to UI, updating metadata to support this with more specific get methods

## 0.0.2

### Patch Changes

- d091305: Updating READMEs with new links

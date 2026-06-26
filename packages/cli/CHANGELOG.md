# @jspsych/metadata-cli

## 0.2.0

### Minor Changes

- a5af08c: Detect and expand JSON-serialized nested columns in `generate()`. Flat JSON objects (e.g. `response: {"Q0":4,"Q1":3}`) are expanded into dotted sub-variables (`response.Q0`, `response.Q1`) in `variableMeasured` with correct types and min/max tracking. JSON arrays of objects are extracted into separate Psych-DS compliant CSV files (`{stem}_measure-{col}_data.csv`) with `trial_index` and `element_index` as join keys.
- aab8da8: Extract plain (non-array) object columns into separate Psych-DS CSV files so their expanded sub-variables resolve to real columns. `expandObjectFields` registers dotted sub-variables for object columns (e.g. `response.cb_1`, `calibration_data.type`), but those names previously had no corresponding CSV column, so Psych-DS validation reported `VARIABLE_MISSING_FROM_CSV_COLUMNS` for every one. Object columns are now accumulated into a new `extractedObjects` map (exposed via `getExtractedObjects()`) as one row per trial, and the CLI writes a per-file sidecar CSV (`{stem}_measure-{col}_data.csv`) — mirroring the existing array-of-objects extraction. The row is threaded through the recursive expansion so a column is recorded for every registered descendant (leaf scalars, intermediate object nodes, and nested-array parents), and it reuses the same configurable `arrayJoinKeys` (one row per trial, no `element_index`).
- 35de4b6: Extract arrays of primitives into sidecar CSVs so their elements become real, typed variables. Previously an array of numbers or strings (`block_order: [16,100,4,1]`, `images: [...]`) was recorded only as a single `value:"array"` column with no per-element detail. Such arrays are now extracted like arrays-of-objects, but — since primitives have no field name — each element is recorded under a synthetic `<column>.value` column (distinct from the array parent, which stays `value:"array"`). The element variable gets its proper type with `minValue`/`maxValue` (numeric) or `levels` (string), joinable to its row via the existing join keys + `element_index`. This composes with the nested-array recursion (an array of arrays of numbers yields a grandchild table with a `.value` column) and completes Psych-DS round-tripping for all four cell shapes: scalar, object, array-of-objects, and array-of-primitives.

  Tradeoff: every non-empty primitive-array column now produces its own sidecar CSV, so datasets with many such columns generate substantially more files (e.g. one eye-tracking export grew from 304 to 380 data files). Extraction is the default and there is no new prompt. A future opt-in `primitiveArrayMode: "extract" | "summarize"` could offer an in-place summary alternative, but is intentionally not added here to avoid complicating the CLI flow.

- 686093e: Convert jsPsych JSON data files to CSV and normalize all generated data filenames to the Psych-DS `[keyword-value_]+data.csv` pattern, so generated projects pass the Psych-DS validator.

  - Each `.json` data file is converted to a `.csv` in `data/` (nested objects/arrays serialized as JSON strings via `objectsToCSV`, so no data is lost), with the untouched original preserved under `data/raw/`. The project scaffold creates the `data/raw/` directory, and `dataset_description.json` is left untouched.
  - Output filenames follow the Psych-DS naming pattern. Already-compliant names are kept; for non-compliant ones the CLI prompts once for a keyword (official keywords offered to avoid validator warnings; custom keywords allowed), with the file's current name becoming the value (camelCased, since Psych-DS values forbid hyphens/underscores). The same normalized base names the converted/copied CSV and its extracted-array CSVs, fixing previously invalid extracted-array names.
  - Same-named source files from different subdirectories are kept and disambiguated with a validator-safe counter — both the CSV in `data/` and the original in `data/raw/` — instead of being skipped or silently overwritten. Non-interactive runs fail with a clear message rather than inventing a keyword.

- 3960e63: Integrate psych-ds validator: the CLI now runs Psych-DS validation after loading an existing dataset and after writing the final dataset_description.json, printing a compliance summary with errors always shown and warnings shown under --verbose.
- d9e4485: Recursively unnest nested data inside extracted array elements. Previously an array-of-objects column was extracted one level deep, so an element field that was itself an object (`pointData.point`) or an array (`pointData.gazeSamples`) was kept as a single opaque JSON column. Now element fields recurse: a nested plain object is expanded into deeper dotted columns in the same sidecar row (`pointData.point.x`, `pointData.point.y`), and a nested array-of-objects is extracted into its own grandchild CSV (`..._measure-...GazeSamples_data.csv`). Grandchild tables remain joinable to their specific parent element via a qualified `<column>.element_index` key carried alongside the existing join keys (e.g. `trial_index` + `validation_data.pointData.element_index` + the grandchild's own `element_index`), and every such key/column is registered in `variableMeasured`. This completes Psych-DS round-tripping for arbitrarily nested object/array data — arrays nested inside arrays inside objects now fully expand instead of bottoming out as JSON.
- 5fcce14: Register array-of-objects element fields in `variableMeasured` so extracted sidecar CSVs have no undeclared columns. Previously `accumulateArrayColumn` wrote each element's fields as bare columns (e.g. `x`, `y`) plus `element_index` into the extracted-array CSV, but never added them to `variableMeasured`, so Psych-DS validation reported `CSV_COLUMN_MISSING_FROM_METADATA`. Element fields are now emitted under dotted names (`tobii_data.x`, `validation_data.pointData.point`) — avoiding collisions between same-named fields of different array columns — and each is registered with its correct type and min/max/levels tracking. `element_index` is registered once. Object- and array-valued element fields are recorded one level deep (a single dotted JSON column, `value:"object"`/`"array"`); they are not further expanded or extracted. This is the array-side counterpart to the plain-object sidecar fix and completes Psych-DS column/variable round-tripping for nested data.
- 7921a10: Add smart rename strategies for data files whose names don't follow the Psych-DS pattern. Instead of a single keyword prompt, the CLI now offers a strategy menu with a live old → new sample preview per option: use an identifier column found inside the data (e.g. participant_id, recommended when available), keep only the part that differs between the filenames, give the files fresh sequential names (subject-001, subject-002, …), or keep the whole old filename as the value. Every strategy ends in a full rename preview with collision detection, per-file manual editing, and the option to switch strategies before anything is written. The preview now also lists the sidecar CSVs each file will produce (one per extracted array/object column, e.g. `subject-01_measure-mouseTracking_data.csv`), and a single planner resolves every output name — mains and sidecars together — so the names shown are exactly the names written; if the data and the approved plan ever disagree the run aborts rather than writing an unapproved name. Files whose names are technically valid but use unofficial keywords (e.g. data-xyz.json, which draw a validator warning) now get an opt-in to join the rename flow instead of being silently kept.
- 58ebde8: Add interactive prompt for unknown variable descriptions. After data processing and metadata options, the CLI now detects user-data variables whose descriptions could not be resolved from plugin source and asks whether to fill them in. Users can skip the entire step or skip individual variables by pressing Enter.
- 1435184: Exit code 1 on validation errors; re-prompt for missing required fields; suggest missing recommended fields.

### Patch Changes

- 28f1d57: Improve CLI prompt wording for clarity. Messages, choice labels, descriptions, and error text have been rewritten to use plain language, avoid jargon, and be more actionable for researchers unfamiliar with Psych-DS terminology.
- 585d337: The CLI now writes a `.psychds-ignore` at the dataset root when it preserves raw jsPsych originals under `data/raw/`, so the validator no longer flags them as `FILE_NOT_CHECKED`. This mirrors the behavior the frontend already had.

  The `.psychds-ignore` filename and content (`**/raw/` plus a self-reference, dictated by validator quirks) are now exported from `@jspsych/metadata` as `PSYCHDS_IGNORE_FILENAME` and `PSYCHDS_IGNORE_CONTENT`, so the CLI and frontend share one definition instead of duplicating the literal string.

- 3752739: Send Psych-DS validation errors and warnings to stderr. The failure header and error details use console.error; warning details and the verbose hint use console.warn. The success line remains on stdout.
- 2706ca7: Add unit tests for validatePsychDS covering clean pass, errors, warnings (verbose and non-verbose), plural forms, and validator-throws scenarios.
- da2e8d2: Add Jest test infrastructure and tests for the CLI package. Tests cover `utils.ts`, `validatefunctions.ts`, and `data.ts` (27 tests). Also modernizes `saveTextToPath` from a fire-and-forget callback to an `async` function returning `Promise<void>`.
- 07b78e5: Add unit tests for `preAnalyzeDirectory` in `data.ts`, covering unreadable directories, JSON and CSV duplicate detection, ignored files, worst-file selection, one-subdirectory-deep traversal, and custom join keys.
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

- 9e02b78: Deduplicate directory traversal logic in data.ts. Extracts a shared `collectDataFiles` helper used by `processDirectory`, `enumerateDataFiles`, and `preAnalyzeDirectory`, replacing three near-identical implementations of the top-level + one-subdir-deep walk. Behavior is preserved: `processDirectory` still sorts `dataset_description.json` first and counts directory read errors as failures. Diagnostics (the "can only read subdirectories one level deep" warning and directory-read errors) are gated behind a `warn` flag that only `processDirectory` sets, so the silent pre-passes (`enumerateDataFiles`, `preAnalyzeDirectory`) don't duplicate warnings the user already sees once on the same directory in the same run.
- 8edc7c2: Drop unnamed columns so R-exported datasets validate. R's `write.csv` (with the default `row.names = TRUE`) prepends an unnamed row-index column, so the exported CSV header starts with a bare comma — an empty-string column name. Psych-DS variables require a name, so the column can never appear in `variableMeasured`; left in the on-disk CSV it fails validation with `CSV_COLUMN_MISSING_FROM_METADATA`.

  The strip now lives in the shared data-file path so the CLI and frontend behave identically:

  - `generate()` strips empty/whitespace-only columns from the parsed data up front, with a single warning instead of per-row spam (keeps `variableMeasured` clean and standalone library use safe), via a new exported `stripUnnamedColumns` helper.
  - `buildPsychDSDataFiles` strips the main table before emitting it: a clean CSV keeps its exact bytes (verbatim `mainContent`), while a file with an unnamed column is re-serialised from the cleaned rows. Both the CLI (rename-plan and non-plan paths) and the frontend feed parsed `mainRows`, so the written/zipped/validated CSV always matches the metadata.

  Fixes finding #2 of #109.

- af851eb: Create the output `data/` directory when updating an existing project that doesn't have one. When `--psych-ds-dir` points at a minimal or hand-rolled Psych-DS skeleton with no `data/` subdirectory, writing the first converted CSV failed with `ENOENT`, which surfaced opaquely as `x Data files was unsuccessful with 0 files read` and `MISSING_DATAFILE`/`MISSING_DATA_DIRECTORY`. `processDirectory` now ensures the target `data/` directory exists before writing (recursive, so it's a no-op when present). A brand-new project already got this from `createDirectoryWithStructure`; JSON inputs only dodged it incidentally by creating `data/raw/` first, so CSV-only existing projects were the ones that broke. Fixes #118.
- 06a84fb: fix(cli): don't print a spurious validation failure for existing projects

  When opening an existing project, validation ran before the data files were
  copied into the project, so it always failed with `MISSING_DATA_DIRECTORY` and
  printed a misleading `✘ Psych-DS validation failed` to stderr even when the final
  output was valid. Removed that pre-write call; the post-write validation that
  actually gates the result is unchanged.

- a5311ba: Fix Psych-DS validation always failing on Windows. The relative path passed to the validator contained backslashes on Windows, which the validator could not resolve — causing spurious MISSING_DATAFILE and MISSING_DATASET_DESCRIPTION errors even when the project was generated correctly. Normalize path separators to forward slashes before validation.
- 585d337: Convert uploaded JSON data to Psych-DS CSV in the frontend so datasets validate instead of failing with `MISSING_DATAFILE`.

  Previously the frontend placed uploaded jsPsych JSON files into `data/` unchanged, so the in-browser validator (and the downloadable zip) always failed — Psych-DS only recognises CSV/TSV datafiles whose names match its keyword pattern.

  - `@jspsych/metadata` gains two shared, filesystem-agnostic helpers, `buildPsychDSDataFiles` and `deriveFallbackBase`, that turn a parsed data file (plus any extracted nested array/object columns) into its set of Psych-DS-named CSV outputs. Used by both the CLI and the frontend so the conversion lives in one place.
  - The frontend's Data step now builds a converted `data/` payload during generation — a compliant main CSV, one sidecar per nested array/object column, and the original JSON preserved under `data/raw/` — and Review uses it for both validation and the zip. Auto-derived filenames use the official `subject` keyword (`subject-<stem>`) to avoid the unofficial-keyword warning, and a `.psychds-ignore` is emitted so the preserved `data/raw/` originals don't surface as `FILE_NOT_CHECKED`.
  - The CLI's non-rename-plan conversion path now delegates to the shared `buildPsychDSDataFiles`. No behaviour change.

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

- ca8dc75: Extend the stress-test regression guards with three more Jest suites covering the CSV ingestion path, generation at scale, and cross-file output-name collisions.

  - `@jspsych/metadata` — `csv-input.stress`: pins how `generate(data, {}, "csv")` re-infers types from string cells (numeric coercion incl. whitespace/scientific-notation/`Infinity`/`NaN` rejection, mixed-column downgrade, `"true"`/`"false"` staying categorical, RFC-4180 quoting, unicode, empty/literal-`null` cells, the 50-char level cap, JSON-in-a-cell extraction), and asserts CSV/JSON parity for unambiguously-typed columns.
  - `@jspsych/metadata` — `scale.stress`: feeds a 5,000-row dataset and checks exact numeric extremes, categorical dedup, high-cardinality level accumulation, boolean handling, and a throughput ceiling that guards against accidental O(n²) regressions.
  - `@jspsych/metadata-cli` — `array-collision.stress`: two same-stem files in different subdirectories sharing a nested array column, asserting `processDirectory` disambiguates every main CSV, sidecar, and preserved raw original (no overwrites, all still Psych-DS compliant) — the cross-file collision gap left by the earlier rename suite.

  Test-only change; no library or CLI behavior is modified.

- 5fcd392: Don't block non-interactive runs on the join-key prompt. When `trial_index` isn't unique (the norm for multi-subject data, where it restarts per subject), the CLI previously always opened an interactive checkbox to pick additional join keys — even in a fully-flagged headless run (`--psych-ds-dir` + `--data-dir` + `--metadata-options`, no TTY), which aborted with `✘ User force closed the prompt`. The prompt is now gated on having a terminal; without one, join keys are resolved deterministically via `resolveJoinKeysNonInteractive` (add a sufficient single column, else a minimal sufficient combination, else proceed with a warning that extracted CSVs may contain duplicate rows). Fixes finding #3 of #109.

  Also hardens the rest of the non-interactive path so that "no terminal ⇒ never prompt" holds universally, not just when all three flags are supplied. The remaining prompts (metadata-options fallback, unknown-variable descriptions, missing-required-field loop) now gate on `canPrompt` rather than the flag-only `isNonInteractive`, so a no-TTY run that omits `--metadata-options` falls back to generated defaults with a notice instead of aborting with `✘ User force closed the prompt`.

- 26c5fc0: Parse each data file once instead of twice. `JsPsychMetadata.generate()` now accepts data that is already a parsed array of observations (not just a JSON/CSV string); when given an array it skips parsing, and the caller can pass `synthesizedSourceRecordId` so the synthetic-id description is still applied. The CLI's `processDirectory`/`processFile` now parse a file a single time and hand the rows to `generate()` and to the Psych-DS CSV builder, rather than parsing once for metadata and again for conversion. No change to generated metadata or output files; this reduces CPU and peak memory on large datasets (e.g. multi-MB jsPsych/Tobii exports). Spun out of #95.
- fa17a9e: Add stress-test regression guards to the automated suite so previously-fixed nested-data and filename-normalization behavior can't silently regress.

  Four Jest suites, ported from the standalone `stress-tests/` harnesses so they run under plain `npm test` (and CI) without a build step:

  - `@jspsych/metadata`: `generate()` coherence over a comprehensive nested-data fixture (deep objects, arrays of objects/arrays, mixed-type columns, a `trial_type`-less row, unicode, empties), plus the Psych-DS filename-normalization helper invariants.
  - `@jspsych/metadata-cli`: the `processDirectory` conversion end-to-end (compliant main CSV, `data/raw/` preservation, two-way `variableMeasured` ↔ CSV-column cross-check, and a best-effort Psych-DS validation pass), plus the refusal to write a non-compliant filename non-interactively.

  Test-only change; no library or CLI behavior is modified. The shared fixture lives at `dev/stress/`.

- 4fa760d: Add unit tests for createDirectoryWithStructure in handlefiles.ts.
- 31c5ba9: Accept jsPsych data exported as a `{ "trials": [...] }` wrapper (e.g. from OSF), not just a bare array. A new `unwrapTrials` helper (exported from `@jspsych/metadata`) unwraps the array when the input is exactly that single-key wrapper; every other JSON shape is returned unchanged, so `generate()` still throws on non-array input and the CLI/frontend still skip it. An object with sibling keys (`{ trials: [...], meta: {...} }`) is deliberately left untouched rather than silently discarding its top-level metadata.

  `unwrapTrials` is folded into `parseJsonData`'s whole-document fast path, so every data parse site — `generate()`, the CLI directory pipeline, and the frontend uploader — accepts the wrapper through the one shared parser. A wrapped file is converted to a Psych-DS data CSV (with sidecars) and its literal wrapped original is still preserved under `data/raw/`. Previously such files were silently skipped ("0 files read").

- Updated dependencies [8731c30]
- Updated dependencies [585d337]
- Updated dependencies [f96e1e6]
- Updated dependencies [ed9c25c]
- Updated dependencies [0eeb9a2]
- Updated dependencies [0f4cc4a]
- Updated dependencies [1511d20]
- Updated dependencies [8edc7c2]
- Updated dependencies [a5af08c]
- Updated dependencies [aab8da8]
- Updated dependencies [35de4b6]
- Updated dependencies [e80e57c]
- Updated dependencies [06a84fb]
- Updated dependencies [03a3ce4]
- Updated dependencies [ae0d01c]
- Updated dependencies [c2426be]
- Updated dependencies [e1cb44e]
- Updated dependencies [585d337]
- Updated dependencies [1e63ba6]
- Updated dependencies [3c7d1f7]
- Updated dependencies [3c7d1f7]
- Updated dependencies [72f8a4b]
- Updated dependencies [6b0d1d4]
- Updated dependencies [ca8dc75]
- Updated dependencies [26c5fc0]
- Updated dependencies [d9e4485]
- Updated dependencies [5fcce14]
- Updated dependencies [fa17a9e]
- Updated dependencies [31c5ba9]
- Updated dependencies [55f2f91]
  - @jspsych/metadata@0.1.0

## 0.1.1

### Patch Changes

- Updated dependencies [974243d]
  - @jspsych/metadata@0.0.3

## 0.1.0

### Minor Changes

- 556ac95: Adding flags for skipping steps in the prompting process and cleaning up verbose mode

## 0.0.2

### Patch Changes

- d091305: Updating READMEs with new links
- Updated dependencies [d091305]
  - @jspsych/metadata@0.0.2

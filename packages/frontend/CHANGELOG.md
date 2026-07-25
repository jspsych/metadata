# frontend

## 0.1.0

### Minor Changes

- d764dc3: The web wizard can now preload an allowlisted sample dataset from a `?sample=` deep link (e.g. `/wizard?sample=serial-reaction-time`). When the docs site forwards a known slug, the wizard skips the landing screen, fetches the bundled sample, and processes it automatically — so a visitor can see the tool run on real jsPsych data with no download-and-re-upload. The slug only ever indexes an internal allowlist (`SAMPLE_DATASETS`), never a raw fetch URL, and an unknown slug is ignored. Backs the new "Serial Reaction Time" before/after example on the documentation site.

  The Variables step also now starts with every row collapsed, so the initial view matches the "Expand all" toggle.

- 585d337: Convert uploaded JSON data to Psych-DS CSV in the frontend so datasets validate instead of failing with `MISSING_DATAFILE`.

  Previously the frontend placed uploaded jsPsych JSON files into `data/` unchanged, so the in-browser validator (and the downloadable zip) always failed — Psych-DS only recognises CSV/TSV datafiles whose names match its keyword pattern.

  - `@jspsych/metadata` gains two shared, filesystem-agnostic helpers, `buildPsychDSDataFiles` and `deriveFallbackBase`, that turn a parsed data file (plus any extracted nested array/object columns) into its set of Psych-DS-named CSV outputs. Used by both the CLI and the frontend so the conversion lives in one place.
  - The frontend's Data step now builds a converted `data/` payload during generation — a compliant main CSV, one sidecar per nested array/object column, and the original JSON preserved under `data/raw/` — and Review uses it for both validation and the zip. Auto-derived filenames use the official `subject` keyword (`subject-<stem>`) to avoid the unofficial-keyword warning, and a `.psychds-ignore` is emitted so the preserved `data/raw/` originals don't surface as `FILE_NOT_CHECKED`.
  - The CLI's non-rename-plan conversion path now delegates to the shared `buildPsychDSDataFiles`. No behaviour change.

- 03a3ce4: Add in-browser Psych-DS validation to the Review step. A "Validate dataset" button runs the official `psychds-validator` web bundle directly in the browser against the generated `dataset_description.json` and the uploaded data files, showing a pass/error/warning report inline instead of only pointing users to the CLI. The validator bundle is code-split and lazy-loaded on first use, and the command-line instructions remain available as a fallback.

### Patch Changes

- 326af48: Ingest jsPsych CSVs that violate strict RFC-4180 quoting — e.g. an unquoted `stimulus` column containing literal `"` (`<div class = "EncodingBox">`) or BOTH quotes and commas (`<p>Press "F", "J" to respond</p>`). Such files previously failed to parse and were dropped entirely ("0 files read").

  - `parseCSV` now escalates leniency only as far as a file requires: strict RFC-4180 first (well-formed files are never reinterpreted), then csv-parse `relax_quotes` (unescaped quotes, no embedded commas), then a row-repair fallback that reassembles rows over-split by commas inside unquoted/improperly-quoted text (a comma followed by a space is treated as literal — machine-written delimiters never have one). A row that still can't be matched to the header is skipped with a warning; one bad row costs that row, not the file. Malformed files are parsed up to three times (clean files once) — a deliberate trade against the single-parse fast path.
  - A new `parseCSVForWrite` helper reports whether the content was already strictly valid CSV (`verbatimSafe`). The CLI and frontend use it so a clean file keeps its exact bytes (written verbatim), while a file that only parsed leniently is re-serialised to well-formed CSV — and a console warning says so, since the original bytes were reinterpreted. Without this the malformed bytes were copied into the Psych-DS `data/` payload and the validator rejected them with `CSV_FORMATTING_ERROR`.

  Net effect: datasets like OSF phxq4 (1258 files of unquoted stimulus HTML, many with embedded commas) now ingest and pass Psych-DS validation through both the library/CLI and the browser uploader.

- 2043d13: Bump vite 5.4 → 6.4.3 (fixes GHSA-fx2h-pf6j-xcff `server.fs.deny` bypass, GHSA-4w7w-66w2-5vf9 path traversal, GHSA-v6wh-96g9-6wx3 launch-editor NTLMv2 hash disclosure) and @vitejs/plugin-react-swc to ^4.3.1. Dev-tooling only; no behavior change in the built app.
- ffe5647: In-browser validation now checks the dataset the user actually downloads. The zip has always shipped placeholder `README.md` and `CHANGES.md`, but the validator never saw them, so every run reported `MISSING_README_DOC` / `MISSING_CHANGES_DOC` for documents the download does contain — and the Review step carried a note explaining the false alarm away. The validator is now handed the same two files (both Psych-DS rules are presence-only, so this is an honest check, not a suppression), the warnings no longer appear, and the note is gone. Their content lives once in `datasetLayout.ts`, shared with the zip builder so the two can't drift. Saving only `dataset_description.json` produces no such files, so those warnings correctly still appear there.

  Review also no longer points at `npx @jspsych/cli validate` — a package that does not exist on npm, with a subcommand the metadata CLI never had. Since validation now covers the whole downloaded project, the re-validation block was removed rather than corrected.

  Wizard copy was rewritten throughout for researchers rather than developers: plainer field hints (`URL or SPDX identifier` → `A standard license name like CC-BY-4.0, or a link to the license text`), `@type` relabelled **Author type** and `Privacy policy` **Sharing restrictions** (both still naming the underlying JSON key), errors that say what to do next, no raw exception text in the file list, and a processing summary that reports outcomes (`Finished. 3 files read, 1 skipped.`) instead of counting skipped and failed files as processed. Destructive confirmations now state that files on disk are untouched.

- a907e98: Document the frontend's in-browser Psych-DS validation flow and the JSON→CSV data-conversion pipeline. Adds "Data conversion pipeline" and "In-browser validation" sections to `docs/dev/frontend-architecture.md` (covering `validatePsychDS`, the `WebFileTree` build, the `schema: 'latest'` choice, `ValidationUnavailableError`, and the zip-resolved README/CHANGES warnings), and notes in the user README explaining that JSON data is converted to Psych-DS CSV (originals kept under `data/raw/`) and what the in-browser validator reports. Documentation only — no behavior change.
- 8edc7c2: Drop unnamed columns so R-exported datasets validate. R's `write.csv` (with the default `row.names = TRUE`) prepends an unnamed row-index column, so the exported CSV header starts with a bare comma — an empty-string column name. Psych-DS variables require a name, so the column can never appear in `variableMeasured`; left in the on-disk CSV it fails validation with `CSV_COLUMN_MISSING_FROM_METADATA`.

  The strip now lives in the shared data-file path so the CLI and frontend behave identically:

  - `generate()` strips empty/whitespace-only columns from the parsed data up front, with a single warning instead of per-row spam (keeps `variableMeasured` clean and standalone library use safe), via a new exported `stripUnnamedColumns` helper.
  - `buildPsychDSDataFiles` strips the main table before emitting it: a clean CSV keeps its exact bytes (verbatim `mainContent`), while a file with an unnamed column is re-serialised from the cleaned rows. Both the CLI (rename-plan and non-plan paths) and the frontend feed parsed `mainRows`, so the written/zipped/validated CSV always matches the metadata.

  Fixes finding #2 of #109.

- 7b812fc: The wizard now fits a phone screen. It previously had no width breakpoints at all, so the fixed 210px step rail left roughly 165px of usable content on a 375px device. Below 700px the rail becomes a horizontal top bar — the same nodes and connector rotated a quarter turn, each label under its node — so every step stays visible without hiding navigation behind a menu. The remaining layouts follow: the landing cards stack and scroll from the top instead of centering and clipping on a short screen, the JSON preview drawer takes the full width now that there is no side rail to sit beside, the Variables description/type pair and the Authors paired fields drop to one column, picker and action rows wrap, and the JSON viewer's per-level indent tightens so deep nesting no longer runs off the screen.

  Form controls are also held at 16px on small screens: iOS Safari auto-zooms whenever a focused control is smaller than that, and every field here was around 14px, so tapping one zoomed the page in and left it scrolled sideways.

- b3d9c6b: Fix wizard state-loss bugs (existing metadata no longer reloads on revisit, additive vs replace upload flows keep metadata and staged data consistent, navigation locked during processing, picked files survive navigation); bound zip download/upload memory (sequential compression with backpressure, blob-based zip extraction); accessibility pass (aria-live regions, native dialog for JSON preview, label associations); beforeunload guard for unsaved work.
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

- 7c4946b: The web wizard can now be embedded in an iframe (used by the new metadata documentation site). When it detects it's framed it hides its own theme toggle and duplicate brand header, and follows the host page's light/dark theme via `postMessage`. Its Vite base path is configurable through `VITE_BASE`, and its "Learn more" / "What is Psych-DS?" links now point at the docs Introduction page.
- Updated dependencies [8731c30]
- Updated dependencies [585d337]
- Updated dependencies [f96e1e6]
- Updated dependencies [ed9c25c]
- Updated dependencies [326af48]
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
- Updated dependencies [9b406ee]
- Updated dependencies [1e63ba6]
- Updated dependencies [3c7d1f7]
- Updated dependencies [3c7d1f7]
- Updated dependencies [72f8a4b]
- Updated dependencies [b240e8b]
- Updated dependencies [6b0d1d4]
- Updated dependencies [ca8dc75]
- Updated dependencies [26c5fc0]
- Updated dependencies [d9e4485]
- Updated dependencies [5fcce14]
- Updated dependencies [fa17a9e]
- Updated dependencies [31c5ba9]
- Updated dependencies [55f2f91]
  - @jspsych/metadata@0.1.0

## 0.0.2

### Patch Changes

- 974243d: Updating frontend to be more user-friendly with major edits to UI, updating metadata to support this with more specific get methods
- Updated dependencies [974243d]
  - @jspsych/metadata@0.0.3

## 0.0.1

### Patch Changes

- Updated dependencies [d091305]
  - @jspsych/metadata@0.0.2

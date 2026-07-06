# Repository Review & Improvement Plan

*Full review of jspsych/metadata conducted 2026-07-06 against `main` (224d336). Baseline: all 656 tests in 44 suites pass. Findings below were produced by a systematic review of all three packages, the open PRs, and repo infrastructure; bugs marked **[verified]** were reproduced by executing code against the built library or tracing the exact call path.*

## Executive summary

The project is in good shape: active development, a healthy 656-test suite, recently corrected docs, and a working changesets release pipeline. The review nevertheless found a cluster of **silent data-loss bugs** that sit directly on the paths users exercise most (editing variable descriptions, updating an existing project, uploading data in batches), a set of **performance issues that block exactly the large datasets issue #95 cares about**, and **CI gaps** (no typecheck for the CLI, EOL Node, lint never runs) that let these classes of bugs ship.

The plan is organized into six workstreams, ordered by impact. Phase 0 (PR triage + release) and Phase 1 (data-loss fixes) are the urgent parts.

---

## Phase 0 — Open PR triage & release hygiene

### PR #132 (CSV unescaped quotes) — **merge after minor touch-ups**
- Code is correct for its scope; CI green; verbatim/re-serialise split is sound.
- Before merge: temper the PR description ("all files read" over-claims — fields containing both `"` **and** `,` still fail with `Invalid Record Length`; this is honestly tracked as a `test.failing` spec in `csv-input.stress.test.ts` but the table implies full coverage).
- Cheap hardening: add a BOM guard (or doc note) in `parseCSVForWrite` — it passes `bom: true`, so a library consumer handing it BOM'd content gets `verbatimSafe: true` and could re-introduce the #130 bug; add a CRLF-verbatim regression test.
- Follow-up issue to file: the quote+comma case (arguably more common in jsPsych instruction stimuli than quote-only) still drops files per-file. A custom pre-scan/repair pass is the likely fix; `relax_column_count` is not (it trades loud drops for silent mis-splits).

### PR #133 (preserve originals under data/raw/) — **request changes before merge**
- The `transformed` predicate is logically sound (traced across all four cases), and conservative failure modes point the safe direction. But three blockers:
  1. **Storage doubling for the common case.** For a renamed-but-clean CSV the raw copy is byte-identical to the `data/` output; on a 1258-file dataset that doubles disk (CLI) and doubles in-browser memory + zip size (frontend) — directly against the #95 memory work. Recommend: record original filenames in a small manifest (e.g. `data/raw/original-names.json`) for the rename-only case, and copy content only when bytes actually changed; or at minimum an opt-out flag. Needs maintainer sign-off since it changes output layout of currently-working datasets.
  2. **Docs contradict the new behavior** and aren't updated in the diff: `docs/cli-guide.md:220`, `docs/cli-reference.md:86` ("CSV inputs are not duplicated under raw/"), `docs/using-the-frontend.md:40`.
  3. Stacked on #132 — must be retargeted to `main` after #132 lands.
- Also worth fixing while in there: `data/raw/` collisions across re-runs into the same output dir silently overwrite (disambiguation only guards within one run's in-memory Set) — pre-existing for JSON but this PR widens the surface to nearly every CSV.

### PR #47 (Version Packages) — **release soon**
- ~50 pending changesets; a month of merged behavior changes (BOM fix, JSONL, ignore files, streaming download) is unpublished. `mergeable_state: unstable` is only the standard "no checks run on GITHUB_TOKEN pushes" limitation — nothing is broken. Merge and publish, then adopt a shorter release cadence.
- Before publishing, fix stale package metadata (see Phase 4, item 4): `packages/metadata/package.json` points `repository`/`bugs` at `jspsych/jsPsych`, so the npm page links to the wrong repo.

---

## Phase 1 — Silent data-loss bugs (highest priority)

These all destroy user work or produce corrupt output without any error. Several share one root cause, so they should be fixed as a coherent group.

### 1a. The destructive-getter cluster (library + frontend, one root cause)

`getMetadata()` → `getList()` → `collapseDescription()` mutates stored state and drops user input:

| Bug | Location | Effect |
|---|---|---|
| User-edited descriptions silently discarded **[verified]** | `VariablesMap.ts:167-170` (`collapseDescription` deletes the `default` key whenever any plugin key exists — never checks if it's real user text vs the `"unknown"` placeholder) | Editing a description for any plugin-documented or system variable (`trial_type`, `rt`, …) in the web wizard shows the edit in the UI but ships the plugin text in the downloaded JSON. The UI explicitly promises the opposite (`Variables.tsx:162-164`). |
| `getMetadata()` mutates internal state **[verified]** | `index.ts:145-151`, `VariablesMap.ts:134-143` | Opening the read-only JSON preview (`PreviewDrawer.tsx:13`) permanently collapses descriptions; a second `generate()` on the same instance (the CLI's exact multi-file flow) then re-wraps/duplicates description text. Also embeds `author: []` into the live metadata object. |
| `getMetadataFields()` deletes from live state | `index.ts:172-178` | A "getter" that mutates and returns an internal reference. |

**Fix:** introduce a non-mutating `toJSON()`/`serialize()` that owns Psych-DS collapsing on a **copy**; make `collapseDescription` prefer a non-`"unknown"` `default` (user text) over plugin keys; make all getters return defensive copies. This one change fixes the top frontend bug, the CLI multi-generate corruption, and removes the CLI's fragile `variable.description = {}` workaround (`cli/src/index.ts:296-301`).

### 1b. Library ingestion crashes & corruption

1. **Extension columns crash `generate()` for CSV input [verified]** — `index.ts:547,651-657`: `extension_type` is read before per-column JSON parsing, so CSV input (`'["mouse-tracking"]'` as a string), a missing `extension_version`, or a single-string `extension_type` all throw and fail the whole file. Normalize both columns to arrays and guard `extensionVersion?.[index]`.
2. **String `description` in metadata options corrupts the variable [verified]** — `VariablesMap.ts:355-391`: `generate(data, { variables: { rt: { description: "Reaction time" } } })` spreads the string char-by-char into `{"0":"R","1":"e",…}`. Accept plain strings (wrap as `{ default: text }`).
3. **`null` rows in JSON arrays crash `generate()` [verified]** — `utils.ts:454`, `index.ts:544`. Skip non-object observations with a warning (note `parseJsonData` can itself emit `[null]` from a JSONL line).
4. **`objectsToCSV` never escapes header names [verified]** — `utils.ts:389`: a column key containing `,` (survey question text) yields a structurally corrupt sidecar CSV. One-line fix: `headers.map(escape).join(',')`.
5. **Numeric coercion mangles identifier-like strings [verified]** — `index.ts:594-599`: `"007"` → `minValue: 7` while the verbatim CSV still contains `007`; 17-digit ints lose precision. Add a round-trip check (`String(Number(v)) === v.trim()`) before treating a string as numeric.

### 1c. CLI silent failures

1. **Swallowed prompt errors → writes to a literal `undefined/data` dir** — `cli/src/index.ts:189-222`: Ctrl+C at the project-structure prompt is caught by an empty `catch`, the function returns a string that destructures into `undefined`s, output lands in `./undefined/data`, and final validation is skipped with exit 0. Remove the catch; fix the fall-through return type.
2. **Invalid existing `dataset_description.json` is silently overwritten (data loss)** — `validatefunctions.ts:88-118` never parses JSON; `loadMetadata` failure is logged and **ignored** at both call sites (`index.ts:216,687`), then `index.ts:778` overwrites the user's hand-edited file with regenerated defaults. Make `validateJson` actually parse; abort on `loadMetadata` failure. Same hole makes a broken `--metadata-options` file silently a no-op (`data.ts:589-604`).
3. **Partial ingestion failure exits 0** — `index.ts:763` discards `processDirectory`'s `{ total, failed }`. Scripted/CI users can't detect dropped files. Propagate into the exit code; also pre-filter non-data files (`.DS_Store`, `notes.txt`) with `isDataExt` as the rename pre-pass already does.
4. **Source `dataset_description.json` copied into `<project>/data/`** — `data.ts:386-389` produces a stray file the validator flags. (The test named for this behavior doesn't actually assert its absence.)
5. **Validator crash reported as a pass** — `validatefunctions.ts:32-35` returns `hasErrors: false` when `validate()` throws → exit 0 for a never-validated dataset.

### 1d. Frontend wizard state-loss

1. **Revisiting Project Info reverts all session edits** — `ProjectInfo.tsx:57-84` re-runs `loadMetadata` on every mount (pages remount on each step change, `AppShell.tsx:76-106`): deleted authors resurrect, edited variables revert, form session is clobbered. Load once (flag in `AppShell`).
2. **"Upload additional files" / "Change folder" corrupts metadata↔dataset consistency** — `DataUpload.tsx:143,259-260`: re-processing `store.clear()`s previously staged files but never resets `jsPsychMetadata`, so the zip contains only the last batch while metadata describes all batches — the in-browser validator then reports mismatches on a dataset the user believes is complete. Either truly append (don't clear; persist `usedArrayFilenames` across runs) or make "Replace data" explicit and reset variables.
3. **Navigation during processing silently loses the run** — nothing disables the sidebar while `runGenerate` is in flight (`DataUpload.tsx:243-360`); partial variables are absorbed, staged store orphaned, UI returns to `idle`. Block navigation or lift the run into `AppShell`.
4. Supporting fixes: `webkitdirectory` lost after phase-branch remounts (`DataUpload.tsx:135-137` — set it in JSX, not a mount-only effect); picked-but-unprocessed files vanish on navigation (`initialPhase` at `DataUpload.tsx:111-112`; move `sourceName` into the session); "Variables loaded from existing metadata" shown even when the parse failed (`AppShell.tsx:33-35`).

**Deliverable for Phase 1:** each fix lands with the regression test that would have caught it (see Phase 5 — most of these are structurally untestable under the current all-mocked test setup, so the integration-test work is a co-requisite).

---

## Phase 2 — Performance & memory (issue #95 and friends)

Ordered by measured/expected impact on the large-dataset use case:

1. **Quadratic `levels` accumulation** — `VariablesMap.ts:318`: `levels.includes()` per value is O(n²); a 94k-distinct-value column is ~4×10⁹ comparisons plus an unbounded `levels` array serialized into the JSON. Use a `Set` internally **and** cap cardinality (e.g. stop at 100 distinct with a note, or auto-detect identifier-like all-distinct columns and skip levels). This alone likely dominates runtime on the Tobii-class datasets.
2. **CLI parses every file 3–4× and runs the full `generate()` pipeline twice** — `analyzeOutputColumns` (unconditional throwaway generate over all files), `buildRenameStrategies` ID scan, `preAnalyzeDirectory` join-key scan, then `processDirectory` for real. Cheap wins: skip `analyzeOutputColumns` when a filename sweep finds nothing to rename; merge `preAnalyzeDirectory` into it. ~2× runtime, up to 4× I/O saved.
3. **Per-cell async + redundant description merges** — `index.ts:560-660`: every cell awaits `getPluginInfo` (a promise round-trip even on cache hit) and re-merges descriptions for the same `(variable, plugin)` pair on every row. Memoize seen pairs → millions of promises avoided on 100k-row files.
4. **Frontend zip download has no backpressure and spawns one worker per file** — `datasetZip.ts:49-64`: fflate `AsyncZipDeflate` per entry spawns ~N workers nearly simultaneously and buffers later entries' compressed output until earlier ones finish — the "one file's working set" header comment doesn't hold. Await each entry's completion before adding the next; push blobs in chunks instead of whole-file `arrayBuffer()`.
5. **Frontend zip *upload* keeps the whole archive in heap for the app's lifetime** — `DataUpload.tsx:155-169`: JSZip inflates everything into in-memory `File`s mirrored into session state, defeating the OPFS staging work. Stream extraction into the staged store; consider replacing jszip with fflate's streaming `Unzip` (also removes a duplicate dependency).
6. **Issue #95 itself** — partially stale: `extractedArrays` resets per `generate()` and the CLI flushes sidecars per file, so accumulation is per-file, not per-study. Update the issue. The remaining hotspot is per-file peak (raw string + parsed rows + extracted row objects + full sidecar string simultaneously). If profiling shows it matters: an optional streaming sink on `generate()` (`onExtractedRows(column, rows)` flush callback) plus a batch/generator form of `objectsToCSV`.
7. Smaller: `analyzeJoinKeys` O(rows × candidates²) composite-string rebuilds (`utils.ts:264-301`); `reduceIdCandidates` early-exit never fires when no ID column exists (`cli/src/rename.ts:104-114`); batch frontend per-file status updates to stop O(N²) re-renders during processing (`DataUpload.tsx:251-346`).

---

## Phase 3 — CI, typing & tooling

1. **Typecheck all packages in CI** (highest-leverage prevention). `packages/cli` is never typechecked at all (esbuild-only build, sucrase test transform); frontend excludes `tests/`; metadata tsconfig is non-strict. Add a root `typecheck` script (`tsc --noEmit` per package) + CI step. Then ratchet strictness: `noImplicitAny` first in `packages/metadata` — the string-description bug (1b.2) is exactly the class strict typing catches. Longer-term: `strict: true`, fixing the `getVariable(): VariableFields | {}` union and the implicit-`any` public `generate()` signature along the way.
2. **Node versions**: CI pins Node 20.x (EOL 2026-04-30). Move to 22.x, ideally a 22/24 matrix for a published CLI; declare `engines` in package.json.
3. **Run lint in CI**: frontend has ESLint + a `lint` script that nothing runs; metadata/cli have none. Add `npm run lint --workspaces --if-present` to ci.yml; migrate to flat-config ESLint 9 across packages (current ESLint 8.57 is EOL); add Prettier or at least .editorconfig.
4. **Package metadata & publishing correctness**: fix `packages/metadata` `repository`/`bugs` URLs (point at jspsych/jsPsych); pin `packages/cli`'s `"@jspsych/metadata": "*"` to a real range before publishing; reorder `exports` so `"types"` precedes `"import"`/`"require"`; remove dead `build:types` script (references nonexistent `tsconfig.build.json`); guard CLI `main()` with a main-module check so `import '@jspsych/metadata-cli'` doesn't launch an interactive session; add a minimal smoke test of the built `dist/` artifacts (a broken exports map currently passes CI).
5. Housekeeping: remove vestigial `husky` devDep (no `.husky/`); fix root `build` script's ignored `--platform=node`; add `cache: npm` to release.yml's setup-node; revisit the security `overrides` block once transitive deps catch up; expand the 2-line root README with install/usage + links into `docs/`.

---

## Phase 4 — Test coverage

The 656-test suite is strong on pure functions but the highest-risk seams are exactly the untested ones:

1. **One real integration test for the frontend wizard** — `DataUpload.test.tsx` mocks the entire `@jspsych/metadata` library and `AppShell.test.tsx` stubs every page, so no test exercises real cross-step state. A single test rendering `AppShell` with the real library (upload → edit description → Review JSON) would have caught all four HIGH frontend bugs. This is the single most valuable new test in the repo.
2. **CLI `index.ts` is untestable** — `main()` runs on import and no helpers are exported. Export the prompt helpers (or split into modules) and cover: `pattern`/`sequence`/`stem` rename strategies end-to-end (only `data-id` has an e2e test), `promptJoinKeys`, the update-existing-project flow (including the Ctrl+C and invalid-JSON paths from 1c), the missing-required-fields loop, and exit-code assertions for validation failure / partial failure.
3. **Library edge-case suite**: extension columns from CSV / missing version / single string; string descriptions via metadata options; `getMetadata()` interleaved with a second `generate()`; `null` observations; `objectsToCSV` header escaping; `updateMinMax` with one pre-set bound; `updateName` collisions; `PluginCache.generateUnpkg` URL formation and version-keyed caching.
4. **Frontend gaps**: `downloadDatasetZip`/`streamZipToSink` (zero coverage — picker abort, error propagation, sink abort); DataUpload session round-trip on remount; navigation-mid-processing.
5. **Scale-realism test**: current stress test caps at 5k flat rows; add a #95-shaped fixture (tens of thousands of extracted array rows) with a loose time budget to catch quadratic regressions (pairs with Phase 2.1).

---

## Phase 5 — Features (post-stabilization)

Ranked by user value:

1. **Headless CLI completeness**: `--name`, `--output`, `--rename-strategy=…`, `--join-keys`, explicit `--non-interactive`; today a scripted run dies on any non-compliant filename with no recourse. Add `--dry-run` (the plan machinery already computes every output name), `--json` machine-readable summaries, differentiated exit codes, `--version`.
2. **Frontend session persistence** — a reload currently destroys all work; `beforeunload` guard at minimum, IndexedDB session + existing OPFS staging ideally. Pairs with 1d.
3. **Variables page editing depth**: add/delete/rename variables, editable min/max/levels/NA — currently validator errors about extra variables can't be fixed in-app.
4. **Offline/bundled plugin descriptions**: ship a pre-extracted description map for core `@jspsych/plugin-*` packages with unpkg as fallback; makes CLI runs deterministic/offline and fixes the cache ignoring `version`/extension flag (`PluginCache.ts:32-34`).
5. **Psych-DS completeness**: populate `na`/`naValue` (empty cells are already detected and skipped); TSV support (`isValidPsychDSDataFilename` already accepts `.tsv` but `parseCSV` hardcodes `,`); lightweight self-validation of generated JSON before writing.
6. **Frontend niceties**: `showDirectoryPicker()` write-in-place on Chromium (eliminates the zip step), drag-and-drop, progress + cancel during processing, editable README/CHANGES (clears the two warnings the Review page apologizes for), author reordering (the unused arrow SVGs suggest it was planned), auto-validate on entering Review.
7. **Accessibility pass**: no `aria-live`/`role="alert"` anywhere; PreviewDrawer is a non-modal "dialog" with no focus trap (use native `<dialog>` like Sidebar does); unassociated labels on the Variables page.
8. **Fix misleading disambiguation names** (library + CLI + frontend share it): collisions on `subject-1_data.csv` currently yield `subject-12_data.csv` — indistinguishable from a real subject 12; use a distinct suffix (`subject-1_copy-2_data.csv` or `_2` separator).

---

## Suggested sequencing

| Order | Work | Rationale |
|---|---|---|
| 1 | Phase 0: merge #132 (touched up), request changes on #133, merge #47 + fix npm metadata, publish | Unblocks users hit by the CSV bug; clears a month of unreleased fixes |
| 2 | Phase 1a (non-mutating `toJSON()` + `collapseDescription` fix) | One root-cause fix clears the worst frontend bug, the CLI corruption, and a workaround |
| 3 | Phase 3.1–3.3 (typecheck + Node 22 + lint in CI) | Cheap; prevents regressions while the rest lands |
| 4 | Remaining Phase 1 (1b, 1c, 1d) with regression tests | Data-loss elimination |
| 5 | Phase 4.1–4.2 (integration test seams) | Locks in Phase 1; enables safe refactoring |
| 6 | Phase 2 (perf, re-profile #95 after 2.1–2.3, then update/close the issue) | Perf work is safer once the test seams exist |
| 7 | Phase 5 features, prioritized by maintainer | Post-stabilization |

Phases 1–4 are almost entirely non-breaking. The two decisions needing maintainer input: the #133 storage-duplication question (manifest vs copy vs opt-out), and whether `getMetadata()`'s mutation semantics can change in a minor release (recommended: add `toJSON()` alongside, deprecate the mutating behavior, remove at 0.2).

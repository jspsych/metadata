# CLI Package — Developer Guide

This document describes the internal architecture of `packages/cli` for contributors who want to understand, modify, or extend the tool.

For user-facing documentation, see the [README](../../packages/cli/README.md), [Getting Started](../getting-started.md), and [CLI Reference](../cli-reference.md).

---

## Source files

```
packages/cli/src/
├── index.ts            — entry point, CLI arg parsing, all interactive prompts, main() orchestration
├── data.ts             — file I/O: reads data files, processes directories, copies/converts output
├── validatefunctions.ts — validation wrappers: Psych-DS validator, directory/JSON checks
├── handlefiles.ts      — creates the Psych-DS directory scaffold on disk
└── utils.ts            — pure helpers: expandHomeDir, fileStem, disambiguateFilename
```

---

## Module responsibilities

### `index.ts`

The entry point and orchestrator. Owns:
- CLI flag parsing via `yargs` (`--psych-ds-dir`, `--data-dir`, `--metadata-options`, `--verbose`)
- All `@inquirer/prompts` calls (`select`, `input`, `checkbox`)
- `main()` — the top-level async function that sequences every step
- `resolveFilenameNormalization()` — the filename pre-pass (see [Pre-pass design](#pre-pass-design))
- `promptJoinKeys()` — interactive loop for resolving join-key uniqueness
- `promptUnknownDescriptions()` — prompts for variable descriptions left as `"unknown"` by the plugin cache
- `promptProjectStructure()`, `promptName()`, `promptDataDir()`, `metadataOptionsPrompt()` — individual step prompts

`index.ts` is intentionally not unit-tested directly because it can't run without mocking `@inquirer/prompts`. Logic that can be tested in isolation belongs in `data.ts` or `utils.ts`.

### `data.ts`

The file I/O layer. All file-system reads and writes for data processing go through here. Key exports:

| Export | Description |
|--------|-------------|
| `processDirectory(metadata, dir, verbose, targetDir?, options?)` | Walks `dir` (top level + one subdirectory deep), calls `processFile` for each file, tracks success/failure counts. Sorts `dataset_description.json` to the front so existing metadata loads before data files. |
| `processFile` (internal) | Reads a single file, calls `metadata.generate()`, then (if `targetDir` is given) copies/converts the file and writes extracted array and object CSVs. |
| `preAnalyzeDirectory(dir, initialKeys?)` | Silent pre-pass: reads all data files and returns the file with the worst join-key uniqueness (highest `duplicateCount`). Returns `null` if all files are already unique. |
| `enumerateDataFiles(dir)` | Returns `{ filePath, name }` for every file in `dir` (top level + one deep), without warnings. Used by the filename normalization pre-pass. |
| `processOptions(metadata, filePath, verbose?)` | Reads a metadata options JSON file and calls `metadata.updateMetadata()`. |
| `saveTextToPath(text, filePath)` | Writes a string to disk. Used to save `dataset_description.json`. |
| `loadMetadata(metadata, filePath)` | Reads an existing `dataset_description.json` and calls `metadata.loadMetadata()`. |
| `generatePath(inputPath)` | Resolves a relative path against `process.cwd()`; absolute paths are returned unchanged. |

**`collectDataFiles` (not exported)** is the shared traversal function used by `processDirectory`, `preAnalyzeDirectory`, and `enumerateDataFiles`. It returns `{ files, dirErrors }` and accepts a `{ warn }` option — only `processDirectory` passes `warn: true`, so the depth warning and read errors are not duplicated by the silent pre-passes.

### `validatefunctions.ts`

Validation helpers that wrap external checks.

| Export | Description |
|--------|-------------|
| `validatePsychDS(datasetPath, verbose)` | Runs `psychds-validator`'s `validate()` on the given path. Prints pass/fail to stdout/stderr. Returns `{ hasErrors, missingRequiredFields, missingRecommendedFields }`. |
| `parseMissingFields(issues, key)` | Extracts field names from a validator issue's `evidence` string. Used to surface `JSON_KEY_REQUIRED` and `JSON_KEY_RECOMMENDED` issues. |
| `validateDirectory(filePath)` | Returns `true` if the path resolves to an existing directory. |
| `validateJson(filePath, fileName?)` | Returns `true` if the path is a `.json` file that exists on disk. Optionally checks the filename matches `fileName`. |

### `handlefiles.ts`

Single export: `createDirectoryWithStructure(directoryPath)`. Creates the Psych-DS project scaffold synchronously:

```
<project>/
├── data/
│   └── raw/
├── README.md
└── CHANGES.md
```

`dataset_description.json` is not created here — it is written later by `saveTextToPath` once metadata generation is complete.

### `utils.ts`

Three pure, synchronous helpers:

| Export | Description |
|--------|-------------|
| `expandHomeDir(path)` | Replaces a leading `~` with `os.homedir()`. Applied at every I/O boundary. |
| `fileStem(file)` | Returns the filename without extension and without a trailing `_data` suffix. `"subject-1_data.csv"` → `"subject-1"`. |
| `disambiguateFilename(name, used)` | Inserts a counter before the extension until a name not in `used` is found. Used for raw file preservation under `data/raw/`. |

---

## Main data flow

```
main()
  │
  ├─ parse yargs argv
  │
  ├─ [--psych-ds-dir valid?]
  │     yes → loadMetadata + validatePsychDS (informational)
  │     no  → promptProjectStructure → loadMetadata (update) or createDirectoryWithStructure (new)
  │
  ├─ [--data-dir valid?]
  │     yes → use directly
  │     no  → promptDataDir
  │
  ├─ determine isNonInteractive
  │     true when --psych-ds-dir + --data-dir + --metadata-options all valid
  │
  ├─ PRE-PASS 1: resolveFilenameNormalization(dataDir, canPrompt)
  │     enumerateDataFiles → check each name against isValidPsychDSDataFilename
  │     non-compliant + canPrompt  → select keyword once, build normalizedBases map
  │     non-compliant + !canPrompt → process.exit(1)
  │
  ├─ PRE-PASS 2: preAnalyzeDirectory(dataDir, ['trial_index'])
  │     finds worst-case join-key uniqueness across all files
  │     not unique → promptJoinKeys → arrayJoinKeys
  │
  ├─ processDirectory(metadata, dataDir, verbose, projectPath/data, { arrayJoinKeys, suppressJoinKeyWarning, normalizedBases })
  │     for each file: metadata.generate() + copy/convert + write array/object sidecars
  │
  ├─ [--metadata-options valid?]
  │     yes → processOptions
  │     no  → metadataOptionsPrompt
  │
  ├─ [!isNonInteractive] → promptUnknownDescriptions
  │
  ├─ saveTextToPath → dataset_description.json
  │
  └─ validatePsychDS
        hasErrors → process.exit(1)
        missingRequiredFields + !isNonInteractive → prompt to fill in, re-save, re-validate
        missingRequiredFields + isNonInteractive  → process.exit(1)
        missingRecommendedFields → suggest (no exit)
```

---

## Pre-pass design

Two pre-passes run before `processDirectory` to surface interactive decisions before any files are copied or converted.

**Why pre-passes instead of prompting mid-directory-walk?**

`processDirectory` walks files sequentially and would need to interrupt itself mid-stream to ask a question. Pre-passes let the user resolve all interactive decisions upfront, so `processDirectory` can run without any prompts.

### Pre-pass 1 — filename normalization

`resolveFilenameNormalization` calls `enumerateDataFiles` to list all data files, then checks each against `isValidPsychDSDataFilename`. Any non-compliant names are collected; one shared `select` prompt asks the user to pick a Psych-DS keyword (e.g. `subject`). Each non-compliant stem becomes `<keyword>-<stem>_data.csv`.

The result is a `Map<absoluteSourcePath, base>` stored as `normalizedBases`. This is threaded through `processDirectory` → `processFile` as part of `GenerateOptions`. `processFile` never invents a keyword — if a file's path is absent from `normalizedBases` and its own stem is already Psych-DS-compliant, the stem is used directly; otherwise the file is skipped with an error.

**Non-interactive mode:** if any non-compliant filenames exist and prompting is not available, the CLI exits with code 1. It will never silently invent a keyword.

### Pre-pass 2 — join-key analysis

`preAnalyzeDirectory` reads every data file and runs `analyzeJoinKeys` on each, returning the file with the most duplicate rows under `['trial_index']`. If duplicates exist, `promptJoinKeys` runs an interactive loop that lets the user add columns until the combined key is unique (or they explicitly proceed anyway).

The resolved `arrayJoinKeys` is passed to `processDirectory`. `suppressJoinKeyWarning: true` is also set so the per-file warning from `@jspsych/metadata` is not shown again — the user already handled it during the pre-pass.

---

## Interactive vs. non-interactive mode

`isNonInteractive` is `true` when `--psych-ds-dir`, `--data-dir`, and `--metadata-options` are all supplied and valid.

| Behavior | Interactive | Non-interactive |
|----------|-------------|-----------------|
| Project structure prompt | shown | skipped (uses `--psych-ds-dir`) |
| Data dir prompt | shown if `--data-dir` absent/invalid | required via flag |
| Non-compliant filenames | prompt for keyword | `process.exit(1)` |
| Metadata options prompt | shown if `--metadata-options` absent | required via flag |
| Unknown description prompt | shown | skipped |
| Missing required fields | prompt to fill in | `process.exit(1)` |

The `canPrompt` flag additionally checks `process.stdin.isTTY && process.stdout.isTTY` to guard against piped runs that are technically missing flags but have no terminal attached.

---

## `@jspsych/metadata` API used by the CLI

The CLI consumes `JsPsychMetadata` (default export) and several named exports from `@jspsych/metadata`.

**Instance methods used:**

| Method | Where called | Purpose |
|--------|-------------|---------|
| `generate(content, options, format, generateOptions)` | `processFile` | Parse a data file and accumulate variable metadata |
| `getMetadata()` | `main` | Serialize to JSON for saving |
| `loadMetadata(jsonString)` | `processFile`, `loadMetadata` | Load an existing `dataset_description.json` |
| `updateMetadata(options)` | `processOptions` | Apply a metadata options file |
| `setMetadataField(key, value)` | `main` | Set the project `name` and fill in required fields post-validation |
| `getVariableNames()` | `promptUnknownDescriptions` | List all variables to find those with unknown descriptions |
| `getVariable(name)` | `promptUnknownDescriptions` | Read a variable's current metadata |
| `updateVariable(name, key, value)` | `promptUnknownDescriptions` | Write user-supplied description |
| `getExtractedArrays()` | `processFile` | Get array-of-objects columns extracted during `generate()` |
| `getExtractedObjects()` | `processFile` | Get plain-object columns expanded during `generate()` |
| `getArrayJoinKeys()` | `processFile` | Get the join keys used when writing array sidecars |

**Named exports used:**

| Export | Purpose |
|--------|---------|
| `analyzeJoinKeys(data, keys)` | Join-key uniqueness analysis in both pre-passes |
| `JoinKeyAnalysis` | Type for the analysis result |
| `parseCSV(content)` | Parse CSV content in `preAnalyzeDirectory` |
| `deriveArrayFilename(base, colName)` | Derive a sidecar CSV filename from base + column name |
| `disambiguateArrayFilename(name, used)` | Deduplicate Psych-DS output filenames |
| `objectsToCSV(rows, priorityCols)` | Serialize array/object sidecar data to CSV |
| `isValidPsychDSDataFilename(name)` | Check a filename against the Psych-DS pattern |
| `toPsychDSValue(stem)` | Sanitize a file stem to a valid Psych-DS keyword value |

---

## Running the tests

```
cd packages/cli
npm test
```

Tests live in `packages/cli/tests/`. Each test file targets one source module:

| Test file | Module under test |
|-----------|------------------|
| `data.test.ts` | `data.ts` |
| `utils.test.ts` | `utils.ts` |
| `validatefunctions.test.ts` | `validatefunctions.ts` |
| `handlefiles.test.ts` | `handlefiles.ts` |
| `validate-integration.test.ts` | Full `validatePsychDS` integration against real fixture datasets |

`index.ts` is not directly tested because it requires `@inquirer/prompts` to be mocked. The end-to-end validation path is covered by `validate-integration.test.ts`, which runs `validatePsychDS` against the tracked fixture datasets in `dev/e2e/` (`valid-project/` and `invalid-project/`).

---

## Adding a new prompt

1. Write the prompt function in `index.ts` using `@inquirer/prompts`.
2. If the prompt needs file I/O, add the underlying logic to `data.ts` or `validatefunctions.ts` and call it from the prompt wrapper.
3. Determine whether the step has a non-interactive fallback (a CLI flag) or should be skipped entirely in non-interactive mode.
4. Add the step to the `main()` sequence with an appropriate `isNonInteractive` guard.
5. Add unit tests for any logic extracted to `data.ts` / `utils.ts`.

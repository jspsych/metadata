# CLI Reference

This page documents all flags, exit codes, filename rules, and output behaviour for the jsPsych Metadata CLI. For a step-by-step walkthrough of a typical first run, see the [CLI Guide](cli-guide.md).

---

## Running the tool

```
npx @jspsych/metadata-cli [flags]
```

With no flags, the tool runs interactively and prompts you for everything it needs. All flags are optional — any flag you omit will be filled in by a prompt at runtime.

---

## Flags

| Flag | Alias | Type | Description |
|------|-------|------|-------------|
| `--psych-ds-dir` | `-em` | path | Path to an **existing** Psych-DS project folder. Must contain a `dataset_description.json`. Use this when updating a project you have already generated. |
| `--data-dir` | `-d` | path | Path to the folder containing your raw jsPsych data files (`.csv`, `.json`, or `.jsonl`). |
| `--metadata-options` | `-m` | path | Path to a metadata options `.json` file. See [Metadata Options](metadata-options.md). |
| `--verbose` | `-v` | boolean | Print detailed output at each processing step. Shows plugin fetching, variable resolution, and full validation warnings. |
| `--version` | | boolean | Print the CLI version and exit. |

### Notes on flag behaviour

- Paths can use `~` for your home directory (e.g. `--data-dir=~/experiments/raw`).
- If a flag is provided but the path is invalid (or the `--metadata-options` file is not valid JSON), the tool exits immediately with a usage error (exit code `2`). It does **not** fall back to an interactive prompt — a flag you passed explicitly failing silently would hide mistakes in scripts.
- `--psych-ds-dir` implies **update mode** — the tool loads the existing `dataset_description.json` before processing new data. Without this flag, the tool asks whether to create or update.

---

## Non-interactive mode

When all three path flags are provided and valid, every interactive prompt is skipped and the tool runs to completion without user input:

```
npx @jspsych/metadata-cli \
  --psych-ds-dir=/path/to/project \
  --data-dir=/path/to/data \
  --metadata-options=/path/to/options.json
```

Non-interactive mode enforces stricter rules than interactive mode:

- **Non-compliant filenames are a hard error.** In interactive mode, the tool offers a menu of renaming strategies to bring non-compliant filenames into the Psych-DS naming pattern. In non-interactive mode, a non-compliant filename causes the tool to exit immediately with an error message and exit code `2` (usage error). Rename your files before running (see [Data file naming](#data-file-naming) below).
- **Unknown variable descriptions are not prompted.** Variables the tool cannot automatically describe are left as `"unknown"` in the output.
- **Join keys are resolved automatically.** When nested-array rows aren't uniquely identified by `trial_index`, the tool picks the keys deterministically instead of prompting, and reports the choice (see [Nested arrays and join keys](#nested-arrays-and-join-keys)).

The tool also runs without prompting whenever it isn't attached to an interactive terminal (for example, piped output or a CI job), even if you omit some flags. In that case it keeps the generated metadata defaults unless `--metadata-options` is supplied. Non-interactive mode is useful for running the tool on a schedule, in a script, or on a remote machine.

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed successfully. Psych-DS validation passed (warnings are allowed). |
| `1` | Unexpected internal error, or an interactive prompt was aborted (e.g. Ctrl+C). |
| `2` | Usage error: bad flags, a flag pointing at a missing directory, an invalid or malformed JSON input (`--metadata-options`, `dataset_description.json`), or a non-compliant data filename in non-interactive mode. |
| `3` | The generated dataset failed Psych-DS validation with one or more errors. |
| `4` | Partial success: some data files could not be ingested. The metadata written covers only the files that succeeded. |

If a run both fails validation and has ingestion failures, validation takes precedence: the tool exits `3`. Any non-zero code means the output should not be trusted as a complete, valid Psych-DS dataset.

You can use the exit code in a shell script to distinguish failures:

```bash
npx @jspsych/metadata-cli --psych-ds-dir=./project --data-dir=./data --metadata-options=./options.json
case $? in
  0) echo "Success." ;;
  2) echo "Bad flags or inputs — check the command line." ;;
  3) echo "Psych-DS validation failed — check the errors above." ;;
  4) echo "Some data files could not be ingested — metadata is incomplete." ;;
  *) echo "Metadata generation failed — check the output above for errors." ;;
esac
```

---

## Data file requirements

### Accepted formats

The tool accepts the following jsPsych data shapes:

| Format | Notes |
|--------|-------|
| **CSV** | One row per trial. Copied to `data/` under its normalized name. Unnamed row-index columns (the blank leading column some exporters and R add) are dropped. |
| **JSON array** | The standard jsPsych export: `[ {…}, {…} ]`. Converted to CSV. |
| **`{ "trials": [...] }` wrapper** | An object whose single key is `trials` holding the trial array (e.g. OSF exports). Automatically unwrapped, then treated as a JSON array. |
| **JSON-Lines (`.jsonl`)** | One JSON value per line (JATOS and several labs export this way — often one participant's trial array per line). All lines are flattened into a single observation stream. |

JSON and JSON-Lines files are automatically converted to CSV in the output (`data/` folder). CSV files are written to `data/` under their normalized name. Whenever the written output is **not** a byte-for-byte, same-named copy of the input — a converted JSON file, a CSV that was re-serialised to be well-formed, or a CSV that was renamed to a compliant filename — the original is preserved untouched under `data/raw/`, and a top-level `.psychds-ignore` is written so the validator skips the raw copies. Only a clean CSV written verbatim under its own already-compliant name has no `data/raw/` copy.

Files of any other type are ignored during metadata generation.

### Nested arrays and join keys

When a data file contains nested arrays inside a trial, the tool extracts each array into its own Psych-DS CSV. Those rows need a column that uniquely identifies them. If `trial_index` alone isn't unique, the tool prompts (interactively) for additional **join-key** columns, grouping candidates into "Sufficient alone" and "Reduces duplicates", with a "Proceed anyway" escape. In a non-interactive run there is nothing to prompt, so the keys are resolved automatically and the choice is reported in the output. For JSON-Lines input with no per-trial identifier, a `source_record_id` (the source line) is synthesized so the join key can be formed; it marks the source record, not a real participant.

### Folder depth

The tool reads all files in the data folder and one level of subdirectories. Files nested deeper are not processed.

### Data file naming

Psych-DS requires all data files to follow a `keyword-value_data.csv` naming pattern. Each filename consists of one or more `keyword-value` pairs joined by underscores, ending with `_data.csv`.

**Valid examples:**

```
subject-01_data.csv
task-flanker_data.csv
subject-01_session-2_data.csv
study-zebraQuestionnaire_data.csv
```

**Invalid examples:**

```
results.csv                   ← missing keyword-value structure and _data suffix
participant_01.csv            ← underscore instead of hyphen between keyword and value
data_2024-01-15.csv           ← date is not in keyword-value format
flanker_results_data.csv      ← "flanker_results" is not a keyword-value pair
```

In **interactive mode**, the tool detects non-compliant names and offers a menu of naming **strategies**, each with a live preview of what it would produce on your actual filenames:

| Strategy | What it does | When offered |
|----------|--------------|--------------|
| **Use the value found inside each file** | Reads an ID column from the data (one unique value per file) and uses it as the value. The most reliable option, and recommended when available. | Only when such a column exists in *every* file. |
| **Keep only the part that differs** | Strips the shared prefix/suffix across filenames; the varying middle becomes the value (you pick the keyword). | Only when the filenames share a common pattern. |
| **Give the files fresh numbered names** | Replaces names with a clean sequence (`subject-001`, `subject-002`, …); you type the first name. | Always. |
| **Keep the whole old filename as the value** | The fallback: the entire old name becomes one value under a keyword you pick. Nothing is lost, but names get verbose. | Always. |

After you pick a strategy, the tool shows the full set of proposed renames (including any sidecar CSVs from nested arrays, and auto-adjusting name collisions) and lets you **Apply**, **Edit one filename**, or **Choose a different strategy**. Psych-DS values may not contain hyphens or underscores, so those are stripped when a value is derived from a filename. For example:

```
participant_01.csv → subject-participant01_data.csv
flanker_results.json → task-flankerResults_data.csv
```

Files with technically valid names that use an **unofficial keyword** (one not in the table below) are legal but draw a validator warning; the tool offers to rename those too.

Official Psych-DS keywords offered by the tool:

| Keyword | Intended use |
|---------|-------------|
| `subject` | The participant or subject the data belongs to |
| `session` | A session of data collection |
| `task` | The task in which the data was collected |
| `condition` | The experimental condition |
| `trial` | The trial the data belongs to |
| `stimulus` | The stimulus item |
| `study` | The study the data belongs to |
| `site` | The site where data was collected |
| `description` | A free-form label |

Custom keywords are allowed but will produce a validator warning. In **non-interactive mode**, non-compliant filenames are a hard error — rename files before running.

---

## Validation output

After generating `dataset_description.json`, the tool automatically validates the project against the Psych-DS specification.

**Passed:**
```
✔ Psych-DS validation passed (2 warnings).
  (Rerun with --verbose to see warnings.)
```

**Failed:**
```
✘ Psych-DS validation failed: 1 error, 0 warnings.

  Error 1: JSON_KEY_REQUIRED: dataset_description.json is missing required field(s): [description]
```

Warnings are advisory — they indicate recommended fields or practices that aren't strictly required. A dataset with warnings is still valid. Errors must be resolved for the dataset to be Psych-DS compliant.

Run with `--verbose` to see the full list of warnings alongside errors.

If validation fails due to missing required fields and you are running interactively, the tool will prompt you to fill them in before finishing.

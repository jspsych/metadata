---
title: Metadata CLI reference
sidebar_label: CLI reference
description: All flags, exit codes, filename rules, and output behaviour for the jsPsych Metadata CLI.
---

# Metadata CLI reference

This page documents all flags, exit codes, filename rules, and output behaviour for the jsPsych Metadata CLI. For a step-by-step walkthrough of a typical first run, see [Using the CLI](../guides/using-the-cli.mdx).

## Running the tool

```
npx @jspsych/metadata-cli [flags]
```

Every flag is optional. Whatever you don't pass on the command line, the tool asks you for as it runs — so with no flags at all, it simply prompts you for everything it needs.

## Flags

| Flag | Alias | Type | Description |
|------|-------|------|-------------|
| `--psych-ds-dir` | `-em` | path | Path to an **existing** Psych-DS project folder. Must contain a `dataset_description.json`. Use this when updating a project you have already generated. |
| `--data-dir` | `-d` | path | Path to the folder containing your raw jsPsych data files (`.csv`, `.json`, or `.jsonl`). |
| `--metadata-options` | `-m` | path | Path to a metadata options `.json` file. See [Customizing the output](../guides/customizing-output.md). |
| `--verbose` | `-v` | boolean | Print detail at every step: which plugins were fetched, how each variable was worked out, and the full validation warnings. |
| `--version` | | boolean | Print the CLI version and exit. |

### Notes on flag behaviour

- Paths can use `~` for your home directory (e.g. `--data-dir=~/experiments/raw`).
- If you pass a flag but the path is wrong (or the `--metadata-options` file isn't valid JSON), the tool stops immediately with a usage error (exit code `2`). It deliberately does **not** fall back to asking you — a flag that quietly did nothing would hide typos in scripts.
- `--psych-ds-dir` puts the tool in **update mode**: it loads the existing `dataset_description.json` before processing new data. Without the flag, it asks whether you're creating or updating.

## Non-interactive mode

When all three path flags are provided and valid, every prompt is skipped:

```
npx @jspsych/metadata-cli \
  --psych-ds-dir=/path/to/project \
  --data-dir=/path/to/data \
  --metadata-options=/path/to/options.json
```

Non-interactive mode enforces stricter rules than interactive mode:

- **Non-compliant filenames are a hard error.** With no way to offer the renaming menu, the tool exits with code `2`. Rename your files first (see [Data file naming](#data-file-naming) below).
- **Unknown variable descriptions are not prompted.** Variables the tool cannot automatically describe are left as `"unknown"` in the output.
- **Join keys are resolved automatically.** When nested-array rows aren't uniquely identified by `trial_index`, the tool picks the keys deterministically instead of prompting, and reports the choice (see [Nested arrays and join keys](#nested-arrays-and-join-keys)).

The tool also skips prompts whenever there's no one at a terminal to answer them — piped output, a CI job, a scheduled run — even if you omit some flags. In that case it keeps the metadata it generated on its own, unless you pass `--metadata-options`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Finished successfully. Psych-DS validation passed (warnings are fine). |
| `1` | Something went wrong internally, or you cancelled a prompt (e.g. Ctrl+C). |
| `2` | Usage error: bad flags, a flag pointing at a folder that isn't there, malformed JSON (`--metadata-options`, `dataset_description.json`), or a non-compliant data filename in a run with no prompts. |
| `3` | The dataset was generated but failed Psych-DS validation with one or more errors. |
| `4` | Partial success: some data files couldn't be read. The metadata covers only the files that worked. |

If a run both fails validation and couldn't read some files, validation wins and the tool exits `3`. Treat any non-zero code as "don't trust this output as a complete, valid Psych-DS dataset yet."

Branching on the exit code in a script:

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

## Data file requirements

### Accepted formats

The tool accepts the following jsPsych data shapes:

| Format | Notes |
|--------|-------|
| **CSV** | One row per trial. Copied to `data/` under its normalized name. Unnamed row-index columns (the blank leading column some exporters and R add) are dropped. |
| **JSON array** | The standard jsPsych export: `[ {…}, {…} ]`. Converted to CSV. |
| **`{ "trials": [...] }` wrapper** | An object whose single key is `trials` holding the trial array (e.g. OSF exports). Automatically unwrapped, then treated as a JSON array. |
| **JSON-Lines (`.jsonl`)** | One JSON value per line (JATOS and several labs export this way — often one participant's trial array per line). All lines are flattened into a single observation stream. |

Every file ends up in `data/` as a CSV under a Psych-DS compliant name: JSON and JSON-Lines are converted, and CSV files are renamed if their name doesn't already fit the pattern.

Your originals are never modified. Whenever a file has to change on the way in, the untouched original is also saved under `data/raw/`. That covers three cases:

- a JSON or JSON-Lines file converted to CSV;
- a CSV rewritten because it wasn't strictly well-formed (for example, jsPsych stimulus HTML containing unescaped quotes);
- a CSV renamed to fit the Psych-DS pattern.

The one file with no copy under `data/raw/` is a well-formed CSV that already had a compliant name, since it's copied across unchanged. When `data/raw/` is used, the tool also writes a top-level `.psychds-ignore` so the validator doesn't check the originals.

Files of any other type are ignored.

### Nested arrays and join keys

When a trial holds a nested array, the tool extracts that array into its own Psych-DS CSV. Each extracted row needs a way to point back to the trial it came from — a **join key**: a column, or combination of columns, whose values differ for every row.

`trial_index` is tried first. When it isn't enough on its own (most often in files where several participants were merged and `trial_index` restarts at 0 for each), the tool prompts for extra columns, sorted into "Sufficient alone" and "Reduces duplicates", with a "Proceed anyway" escape. In a run with no prompts, the keys are chosen automatically and the choice is reported in the output.

JSON-Lines input sometimes has no per-trial identifier at all. In that case the tool adds a `source_record_id` column recording which line of the file each row came from, so a join key can be formed. It identifies the source record, not a participant.

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
| **Use the value found inside each file** | Reads an ID column out of the data itself (one value per file) and uses that. The most reliable option — pick it when it's offered. | Only when such a column exists in *every* file. |
| **Keep only the part that differs** | Drops whatever every filename has in common; the part that varies becomes the value, under a keyword you pick. | Only when the filenames share a common pattern. |
| **Give the files fresh numbered names** | Replaces the names with a clean sequence (`subject-001`, `subject-002`, …); you type the first one. | Always. |
| **Keep the whole old filename as the value** | The fallback: the entire old name becomes the value, under a keyword you pick. Nothing is lost, but the names get long. | Always. |

Once you pick a strategy, the tool shows every rename it proposes — including the companion CSVs from any nested arrays, with clashing names adjusted for you — and offers **Apply**, **Edit one filename**, or **Choose a different strategy**. Psych-DS values can't contain hyphens or underscores, so those are removed when a value comes from a filename. For example:

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

You may use a keyword outside this list — the dataset is still valid, but the validator will mention it. In a run with no prompts, a non-compliant filename is a hard error; rename those files before you run.

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

Warnings are advice: they point at recommended fields or practices you haven't followed. A dataset with warnings is still valid. Errors are different — the dataset isn't Psych-DS compliant until you fix them.

Run with `--verbose` to see the full list of warnings alongside the errors.

If validation fails because required fields are missing, an interactive run prompts you to fill them in before it finishes.

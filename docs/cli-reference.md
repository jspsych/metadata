# CLI Reference

This page documents all flags, exit codes, filename rules, and output behaviour for the jsPsych Metadata CLI. For a step-by-step walkthrough of a typical first run, see [Getting Started](getting-started.md).

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
| `--data-dir` | `-d` | path | Path to the folder containing your raw jsPsych data files (`.csv` or `.json`). |
| `--metadata-options` | `-m` | path | Path to a metadata options `.json` file. See [Metadata Options](metadata-options.md). |
| `--verbose` | `-v` | boolean | Print detailed output at each processing step. Shows plugin fetching, variable resolution, and full validation warnings. |

### Notes on flag behaviour

- Paths can use `~` for your home directory (e.g. `--data-dir=~/experiments/raw`).
- If a flag is provided but the path is invalid, the tool falls back to prompting for that step interactively.
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

- **Non-compliant filenames are a hard error.** In interactive mode, the tool prompts you to choose a keyword to bring non-compliant filenames into the Psych-DS naming pattern. In non-interactive mode, a non-compliant filename causes the tool to exit immediately with an error message and exit code 1. Rename your files before running (see [Data file naming](#data-file-naming) below).
- **Unknown variable descriptions are not prompted.** Variables the tool cannot automatically describe are left as `"unknown"` in the output.

Non-interactive mode is useful for running the tool on a schedule, in a script, or on a remote machine.

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Completed successfully. Psych-DS validation passed (warnings are allowed). |
| `1` | Psych-DS validation failed with one or more errors, or a non-compliant filename was found in non-interactive mode. |

You can use the exit code in a shell script to handle failures:

```bash
npx @jspsych/metadata-cli --psych-ds-dir=./project --data-dir=./data --metadata-options=./options.json
if [ $? -ne 0 ]; then
  echo "Metadata generation failed — check the output above for errors."
fi
```

---

## Data file requirements

### Accepted formats

The tool accepts `.csv` and `.json` data files produced by jsPsych. JSON files are automatically converted to CSV in the output (`data/` folder); the originals are preserved byte-for-byte in `data/raw/`. CSV files are copied to `data/` under their normalized name; originals are also preserved in `data/raw/`.

Files of any other type are ignored during metadata generation.

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

In **interactive mode**, the tool detects non-compliant names and prompts you to choose a keyword. The file's current name becomes the value (with hyphens and underscores removed, since Psych-DS values may not contain them). For example:

```
participant_01.csv → subject-participant01_data.csv
flanker_results.json → task-flankerResults_data.csv
```

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

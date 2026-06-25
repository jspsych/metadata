# CLI Guide: Organizing jsPsych Data with the Metadata CLI

This guide walks you through using the jsPsych Metadata CLI to turn your raw experiment data into a [Psych-DS](https://psych-ds.github.io/) compliant dataset. By the end, you'll have a structured project folder with a `dataset_description.json` file that describes your experiment and its variables.

If you're not sure whether the CLI or the browser wizard is right for you, start with [Getting Started](getting-started.md). For a complete list of flags, exit codes, and filename rules, see the [CLI Reference](cli-reference.md).

## Before you start

You'll need:

- **Node.js** installed on your computer (version 18 or later). You can check by running `node --version` in your terminal. If it's not installed, download it from [nodejs.org](https://nodejs.org).
- **Your jsPsych data files** — CSV, JSON, or JSON-Lines files produced by your experiment. These can be in one folder or organized into subfolders one level deep. See [Accepted data formats](#accepted-data-formats) below.

## Running the tool

Open a terminal and run:

```
npx @jspsych/metadata-cli
```

The first time you run this, `npx` will download the tool automatically. After that it launches immediately.

---

## Accepted data formats

The CLI reads jsPsych data in any of these shapes:

- **CSV** — one row per trial. Copied to the project as-is (under a Psych-DS compliant name). Unnamed row-index columns (the blank first column R and some exporters add) are dropped.
- **JSON array** — the standard jsPsych export: `[ {…}, {…} ]`. Converted to CSV for the project.
- **`{ "trials": [...] }` wrapper** — some platforms (e.g. OSF) wrap the trial array in an object with a single `trials` key. The CLI unwraps it automatically.
- **JSON-Lines (`.jsonl`)** — one JSON value per line, as JATOS and several labs export it (often one participant's trial array per line). The CLI flattens every line into a single observation stream.

JSON and JSON-Lines files are converted to CSV in the output (`data/` folder) so the Psych-DS validator can read them; your originals are preserved untouched under `data/raw/`. Files of any other type are ignored.

---

## Interactive walkthrough

The following steps use two example data files named `participant_01.csv` and `participant_02.csv`.

### Step 1: Create a new project or update an existing one

```
? What would you like to do?
❯ Create a new project
  Update an existing project
```

Select **Create a new project** if this is the first time you're generating metadata for this dataset. Use **Update an existing project** if you've run the tool before and want to regenerate the metadata (for example, after collecting more data).

---

### Step 2: Choose where to save the project

```
? Path to the folder where the new project will be created:
```

Enter the path to an existing folder — the tool will create a new subfolder inside it for your project. **The folder you enter here must already exist.**

- **Windows:** `C:\Users\yourname\Documents\experiments`
- **Mac / Linux:** `/Users/yourname/Documents/experiments` or `~/experiments`

On Windows, you can copy the path directly from File Explorer's address bar. On Mac, you can drag a folder into the terminal window to paste its path. The `~` character is a shortcut for your home folder on Mac and Linux.

---

### Step 3: Name your project

```
? Enter the project name (used as the folder name and in the metadata): my-experiment
```

The name becomes the subfolder created inside the folder from Step 2, and is recorded in the metadata. Use something descriptive without spaces (hyphens are fine). `my-experiment` here is just an example — use whatever name fits your study; the rest of this guide uses `my-experiment` to illustrate the output.

---

### Step 4: Point to your data

```
? Path to your raw data folder (files will be copied, not moved):
```

Enter the path to the folder containing your jsPsych data files. Use the same path format as Step 2 — the full path to an existing folder on your computer. Your original files are never modified; the tool copies them into the new project.

---

### Step 5: File naming (if your files need renaming)

Psych-DS requires data files to follow a specific naming pattern: `keyword-value_data.csv`. For example, `subject-01_data.csv` or `task-flanker_data.csv`.

If your files don't already follow this pattern, the tool lists them and offers a menu of naming **strategies**:

```
2 data file(s) do not follow the Psych-DS naming pattern ([keyword-value_]+data.csv):
    participant_01.csv
    participant_02.csv

Scanning 2 data file(s) for identifier columns…

? How should these files be renamed?
❯ Use the "subject_id" value found inside each file   (recommended)
        Most reliable: the ID is read from the data itself, so it works even when the old filenames are meaningless.
        participant_01.csv → subject-p01_data.csv
        participant_02.csv → subject-p02_data.csv
  Keep only the part that differs between the filenames
  Give the files fresh numbered names (subject-001, subject-002, …)
  Keep the whole old filename as the value
```

Each strategy shows a live preview of what it would produce, so you can judge the choice on your real filenames:

| Strategy | What it does |
|---|---|
| **Use the value found inside each file** | Reads an ID column from the data (one unique value per file) and uses it as the value. Offered only when such a column exists in every file. The most reliable option — and the recommended one when available. |
| **Keep only the part that differs** | Strips the shared prefix/suffix across the filenames and keeps the varying middle as the value (you'll pick the keyword next). Offered only when the names share a common pattern. |
| **Give the files fresh numbered names** | Replaces messy names with a clean sequence (`subject-001`, `subject-002`, …). You type the first name; the rest continue the numbering. |
| **Keep the whole old filename as the value** | The fallback, always available: squashes the entire old name into one value under a keyword you pick. Nothing is lost, but the names get verbose. |

After picking a strategy you'll see the full set of proposed renames and choose what to do next:

```
Proposed renames:
    participant_01.csv → subject-p01_data.csv
    participant_02.csv → subject-p02_data.csv

? Apply these names?
❯ Apply
  Edit one filename
  Choose a different strategy
```

Choose **Apply** to write the names, **Edit one filename** to hand-tune a single name, or **Choose a different strategy** to go back. Name collisions are flagged and auto-adjusted in the preview before anything is written.

> **If you prefer, rename your files before running the tool.** A compliant name looks like `subject-01_data.csv` — a keyword, a hyphen, a value, then `_data.csv`. Files that already follow this pattern are used as-is, with no prompt. (Files that use an *unofficial* keyword are technically valid but draw a validator warning; the tool offers to rename those too.)

---

### Step 6: Join keys for nested data (only if needed)

Some jsPsych data contains **nested arrays** inside a trial (for example, per-keypress logs). Psych-DS stores these as separate CSV files, which need a column that uniquely identifies each row. If `trial_index` alone isn't unique, the tool asks you to add more columns:

```
⚠  [trial_index] not unique in "participant_01.csv": 12 duplicate rows found.
   Nested arrays need a unique row ID to be saved as separate CSV files.
   Suggested addition: [subject_id]

? Select additional join-key columns for extracted array CSVs:
 ── Sufficient alone ──
❯◉ subject_id
 ── Reduces duplicates ──
 ◯ block
 ──────────────
 ◯ Proceed anyway (extracted CSVs may have duplicate rows)
```

Columns under **Sufficient alone** make every row unique by themselves; columns under **Reduces duplicates** help but may need to be combined. Pick the column(s) that identify a row, or choose **Proceed anyway** to skip. For JSON-Lines data with no per-trial id, the tool synthesizes a `source_record_id` (the line number) so nested data can still be split out — this marks the source record, not a real participant. Most flat datasets never see this prompt.

---

### Step 7: Customize metadata (optional)

```
? Would you like to customize the metadata?
❯ Use defaults
  Use a custom metadata file
```

The tool generates metadata automatically from your data files. If you want to add author names, a study description, or override variable descriptions, choose **Use a custom metadata file** and provide a path to a `.json` file. See [Metadata Options](metadata-options.md) for the format.

Select **Use defaults** for now — you can always edit `dataset_description.json` directly later, or re-run the CLI and provide an options file at that point.

---

### Step 8: Fill in unknown variable descriptions (optional)

After reading your data files, the tool tries to look up what each variable means by checking the jsPsych plugin that produced it. For variables it couldn't identify automatically, it will ask:

```
3 variable(s) have unknown descriptions. Would you like to fill them in?
❯ Fill in descriptions   - You will be prompted for each variable. Press Enter to skip individual ones.
  Skip                   - Leave descriptions as unknown in the dataset_description.json.
```

If you choose to fill them in, you'll see one prompt per variable. Press Enter to skip any you'd rather leave for later.

---

### Step 9: Validation

The tool automatically checks your new project against the Psych-DS specification:

```
✔ Psych-DS validation passed (2 warnings).
  (Rerun with --verbose to see warnings.)
```

A checkmark means your dataset is valid. Warnings are minor issues (like recommended fields that aren't filled in yet) — your dataset is still usable. If there are errors, the tool will describe them and may prompt you to fix required fields before finishing.

---

## What you get

Your new project folder will be inside the location you chose in Step 2, named after the project name from Step 3. For example, if you chose `C:\Users\yourname\Documents\experiments` as the output location and `my-experiment` as the project name, the result is at `C:\Users\yourname\Documents\experiments\my-experiment\`:

```
my-experiment/
├── data/
│   ├── subject-p01_data.csv          Psych-DS compliant copies of your data
│   └── subject-p02_data.csv
├── dataset_description.json          generated metadata
├── README.md                         placeholder for a human-readable description
└── CHANGES.md                        placeholder for a changelog
```

The `data/` folder holds the Psych-DS-compliant copies of your data. The example above starts from CSV files, which are already tabular and so are written straight to `data/`.

If your inputs are **JSON or JSON-Lines**, the tool converts them to CSV in `data/` and additionally preserves your originals untouched under a `data/raw/` folder, alongside a top-level `.psychds-ignore` file that tells the validator to skip the raw copies. (CSV inputs aren't duplicated under `raw/`, so a CSV-only dataset has no `data/raw/` folder.) Data files that contain **nested arrays** produce one extra CSV per nested column.

Open `dataset_description.json` to see what was generated. It will look something like:

```json
{
  "@context": "https://schema.org/",
  "@type": "Dataset",
  "name": "my-experiment",
  "variableMeasured": [
    {
      "@type": "PropertyValue",
      "name": "trial_type",
      "description": "The name of the jsPsych plugin used to run the trial."
    },
    {
      "@type": "PropertyValue",
      "name": "rt",
      "description": "The response time in milliseconds for the participant to make a response."
    }
  ]
}
```

---

## Next steps

- **Edit `dataset_description.json`** to add your name as an author, a study description, or other dataset-level fields.
- **Edit `README.md`** inside your project to add a human-readable description of the experiment.
- **Re-run the CLI** any time you add new data: use **Update an existing project** and point to your project folder — it will reload your existing metadata and incorporate the new files.
- **Share or archive your project folder** — it's a self-contained, Psych-DS compliant dataset.

For automating the tool in scripts (non-interactive mode, flags, exit codes), see the [CLI Reference](cli-reference.md). Prefer a point-and-click interface? See [Using the Web Wizard](using-the-frontend.md).

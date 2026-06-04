# Getting Started: Organizing jsPsych Data with the Metadata CLI

This guide walks you through using the jsPsych Metadata CLI to turn your raw experiment data into a [Psych-DS](https://psych-ds.github.io/) compliant dataset. By the end, you'll have a structured project folder with a `dataset_description.json` file that describes your experiment and its variables.

## What is Psych-DS?

[Psych-DS](https://psych-ds.github.io/) is a community standard for organizing and documenting psychology datasets. A Psych-DS compliant dataset has a predictable folder structure and a machine-readable description file (`dataset_description.json`) that travels with the data, making it easier to share, archive, and reuse — by collaborators, reviewers, or your future self.

If you'd like more background before diving in, see [What is Psych-DS?](what-is-psych-ds.md).

The Metadata CLI automates the most tedious part: generating the `dataset_description.json` by reading your jsPsych data files and looking up what each variable means.

## Before you start

You'll need:

- **Node.js** installed on your computer (version 18 or later). You can check by running `node --version` in your terminal. If it's not installed, download it from [nodejs.org](https://nodejs.org).
- **Your jsPsych data files** — CSV or JSON files produced by your experiment. These can be in one folder or organized into subfolders one level deep.

## Running the tool

Open a terminal and run:

```
npx @jspsych/metadata-cli
```

The first time you run this, `npx` will download the tool automatically. After that it launches immediately.

---

## Interactive walkthrough

This section follows a researcher named Alex who collected data from a flanker task. Alex has two data files, `participant_01.csv` and `participant_02.csv`, saved in `~/experiments/flanker-raw/`.

### Step 1: Create a new project or update an existing one

```
? What would you like to do?
❯ Create a new project
  Update an existing project
```

Select **Create a new project** if this is the first time you're generating metadata for this dataset. Use **Update an existing project** if you've run the tool before and want to regenerate the metadata (for example, after collecting more data).

Alex selects **Create a new project**.

---

### Step 2: Choose where to save the project

```
? Path to the folder where the new project will be created: ~/experiments
```

This is the folder that will *contain* your new project. The tool will create a new subfolder inside it.

Alex enters `~/experiments`.

---

### Step 3: Name your project

```
? Enter the project name (used as the folder name and in the metadata): flanker-study
```

The name becomes the subfolder name and is recorded in the metadata. Use something descriptive without spaces.

---

### Step 4: Point to your data

```
? Path to your raw data folder (files will be copied, not moved): ~/experiments/flanker-raw
```

Your original files are never modified. The tool copies them into the new project.

---

### Step 5: File naming (if your files need renaming)

Psych-DS requires data files to follow a specific naming pattern: `keyword-value_data.csv`. For example, `subject-01_data.csv` or `task-flanker_data.csv`.

If your files don't already follow this pattern, the tool will tell you and ask how to label them:

```
2 data file(s) do not follow the Psych-DS naming pattern ([keyword-value_]+data.csv):
    participant_01.csv
    participant_02.csv

? Choose a Psych-DS keyword to label these files (their current name becomes the value):
❯ subject   - The participant/subject the data belongs to
  session   - A session of data collection
  task      - The task in which the data was collected
  condition - The experimental condition
  trial     - The trial the data belongs to
  stimulus  - The stimulus item
  study     - The study the data belongs to
  site      - The site where the data was collected
  description - A free-form label describing the file
  ──────────────
  Other (custom keyword)
```

Choose the keyword that best describes what your filename refers to. Alex's files are named by participant, so she selects **subject**:

```
    participant_01.csv → subject-participant01_data.csv
    participant_02.csv → subject-participant02_data.csv
```

The part after the hyphen is your original filename (with hyphens and underscores removed, since Psych-DS values don't allow them).

> **If you prefer, rename your files before running the tool.** A compliant name looks like `subject-01_data.csv` — a keyword, a hyphen, a value, then `_data.csv`. Files that already follow this pattern are used as-is, with no prompt.

---

### Step 6: Customize metadata (optional)

```
? Would you like to customize the metadata?
❯ Use defaults
  Use a custom metadata file
```

The tool generates metadata automatically from your data files. If you want to add author names, a study description, or override variable descriptions, choose **Use a custom metadata file** and provide a path to a `.json` file. See [metadata-options.md](metadata-options.md) for the format.

For now, Alex selects **Use defaults**. She can always edit `dataset_description.json` directly later.

---

### Step 7: Fill in unknown variable descriptions (optional)

After reading your data files, the tool tries to look up what each variable means by checking the jsPsych plugin that produced it. For variables it couldn't identify automatically, it will ask:

```
3 variable(s) have unknown descriptions. Would you like to fill them in?
❯ Fill in descriptions   - You will be prompted for each variable. Press Enter to skip individual ones.
  Skip                   - Leave descriptions as unknown in the dataset_description.json.
```

If you choose to fill them in, you'll see one prompt per variable. Press Enter to skip any you'd rather leave for later.

---

### Step 8: Validation

The tool automatically checks your new project against the Psych-DS specification:

```
✔ Psych-DS validation passed (2 warnings).
  (Rerun with --verbose to see warnings.)
```

A checkmark means your dataset is valid. Warnings are minor issues (like recommended fields that aren't filled in yet) — your dataset is still usable. If there are errors, the tool will describe them and may prompt you to fix required fields before finishing.

---

## What you get

After running the tool, Alex's new project is at `~/experiments/flanker-study/`:

```
flanker-study/
├── data/
│   ├── raw/
│   │   ├── participant_01.csv        original files, untouched
│   │   └── participant_02.csv
│   ├── subject-participant01_data.csv   Psych-DS normalized copies
│   └── subject-participant02_data.csv
├── dataset_description.json             generated metadata
├── README.md                            placeholder for a human-readable description
└── CHANGES.md                           placeholder for a changelog
```

The `data/raw/` folder holds your original files exactly as they were. The `data/` folder holds the Psych-DS-compliant copies (JSON files are converted to CSV so the validator can read them).

Open `dataset_description.json` to see what was generated. It will look something like:

```json
{
  "@context": "https://schema.org/",
  "@type": "Dataset",
  "name": "flanker-study",
  "variableMeasured": [
    {
      "@type": "PropertyValue",
      "name": "trial_type",
      "description": "The name of the jsPsych plugin used to run the trial."
    },
    {
      "@type": "PropertyValue",
      "name": "rt",
      "description": {
        "jsPsych-html-keyboard-response": "The response time in milliseconds..."
      }
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

For automating the tool in scripts, see [cli-reference.md](cli-reference.md).

# Using the Web Wizard

A browser-based wizard for generating [Psych-DS](https://psych-ds.github.io/) compliant `dataset_description.json` files from jsPsych experiment data. It mirrors the functionality of the [CLI](cli-guide.md) in a point-and-click interface — nothing to install, and your data never leaves your computer.

If you're not sure whether the wizard or the CLI is right for you, start with [Getting Started](getting-started.md).

> **Note:** for running the wizard locally during development and for its internal architecture, see the [frontend package README](../packages/frontend/README.md) and the [frontend developer guide](dev/frontend-architecture.md).

---

## Welcome screen

Choose one of two starting points:

- **Create new project** — start from scratch. The wizard walks you through each step and produces a downloadable Psych-DS project.
- **Open existing project** — upload an existing `dataset_description.json` to continue editing, or to update the metadata after adding new data files.

A **☾ Dark / ☀ Light** toggle in the top-right corner switches the colour theme. Your choice is remembered across sessions.

---

## Step 1 — Project Info

Fill in basic information about your dataset:

- **Project name** *(required)* — used as the dataset identifier and as the downloaded folder name.
- **Description** — a plain-English summary of the experiment. Defaults to "No description provided." if left blank.
- **License, funding source, keywords, citation** *(optional)* — additional Psych-DS recommended fields.

You can also upload an existing `dataset_description.json` here to pre-fill all fields, with a before/after comparison when the uploaded values differ from anything you've already entered.

---

## Step 2 — Data

Upload your jsPsych data files:

- Click **Choose folder** to browse for a directory (uses the browser's folder picker) **or** click **Upload zip** to upload a `.zip` containing your data files.
- Each file is shown with a status indicator once processed.
- Accepted formats: **CSV**, **JSON arrays**, the **`{ "trials": [...] }` wrapper** (e.g. OSF exports), and **JSON-Lines (`.jsonl`)**. JSON and JSONL are converted to Psych-DS-named CSV (e.g. `data/subject-sub01_data.csv`) so the validator and the downloaded zip both see compliant tables; your originals are preserved under `data/raw/`. CSV uploads are kept as-is.
- If your data files contain **nested arrays**, the wizard checks whether `trial_index` uniquely identifies each row. If not, a **join-key chooser** lets you select additional columns before proceeding — these are used to name the separate CSV files the validator expects.

> **For existing projects:** the Data step is pre-marked complete since your variables are already loaded from the uploaded `dataset_description.json`. You can still upload new data files to regenerate the variable list.

---

## Step 3 — Variables

Review and annotate each variable detected in your data:

- Variables with **unknown descriptions** (those the plugin lookup couldn't fill in automatically) appear in an expanded section at the top.
- Known variables start collapsed. Use **Expand all / Collapse all** to open or close all rows at once.
- Each row has a **Description** text area and a **Type** dropdown. Editing either updates the metadata immediately.
- Long level lists are truncated at five entries with a **Show all N** toggle.

---

## Step 4 — Authors

Add contributors to the dataset:

- Click **Add author** to create a new row. Type a name and press Tab or click away to commit it.
- Expand a row to fill in optional fields: given name, family name, author type, ORCID.
- **Bulk import** lets you paste a list of names (one per line, optionally followed by an ORCID) to add multiple authors at once. Invalid ORCIDs are flagged with a warning banner.

---

## Step 5 — Review

Inspect the generated `dataset_description.json` and download your project:

- The JSON viewer shows a syntax-highlighted, collapsible preview of the output.
- Click **Download `<project-name>.zip`** to download a complete Psych-DS project archive:
  ```
  <project-name>.zip
  ├── dataset_description.json
  ├── README.md
  ├── CHANGES.md
  └── data/
      └── <your data files>
  ```
- If no data files were uploaded, a **Save `dataset_description.json`** button is shown instead.
- **Validate dataset** runs the Psych-DS validator entirely in your browser (an internet connection is required) and lists any errors and warnings inline. Missing `README` / `CHANGES` warnings are expected here — the downloaded zip includes both files, so they clear when you validate the downloaded dataset (e.g. with `npx @jspsych/cli validate`). See the [frontend README](../packages/frontend/README.md#step-5--review) and the [frontend developer guide](dev/frontend-architecture.md) for the full validation flow.

The **{} Preview** pill button (visible on all steps except Review) opens a live JSON snapshot in a slide-in drawer, so you can check the output at any point without leaving the current step.

---

## Next steps

- **Unzip and share** your downloaded project — it's a self-contained, Psych-DS compliant dataset.
- Need to script metadata generation, or already have your data in a local folder? See the [CLI Guide](cli-guide.md).
- Want to customize variable descriptions or authors from a file? See [Metadata Options](metadata-options.md).

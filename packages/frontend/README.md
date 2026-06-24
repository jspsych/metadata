# jsPsych Metadata Generator — Frontend

A browser-based wizard for generating [Psych-DS](https://psych-ds.github.io/) compliant `dataset_description.json` files from jsPsych experiment data. Mirrors the functionality of the CLI tool in a point-and-click interface.

---

## Running locally

1. Clone the repository and install dependencies from the root:
   ```
   git clone https://github.com/jspsych/metadata.git
   cd metadata
   npm install
   ```
2. Start the development server:
   ```
   cd packages/frontend
   npm run dev
   ```
3. Open [http://localhost:5173](http://localhost:5173) in your browser.

Node.js 18 or later is required.

---

## Using the wizard

### Welcome screen

Choose one of two starting points:

- **Create new project** — start from scratch. The wizard will walk you through each step and produce a downloadable Psych-DS project.
- **Open existing project** — upload an existing `dataset_description.json` to continue editing or update the metadata after adding new data files.

A **☾ Dark / ☀ Light** toggle in the top-right corner switches the colour theme. Your choice is remembered across sessions.

---

### Step 1 — Project Info

Fill in basic information about your dataset:

- **Project name** *(required)* — used as the dataset identifier and as the downloaded folder name.
- **Description** — a plain-English summary of the experiment. Defaults to "No description provided." if left blank.
- **License, funding source, keywords, citation** *(optional)* — additional Psych-DS recommended fields.

You can also upload an existing `dataset_description.json` here to pre-fill all fields, with a before/after comparison when the uploaded values differ from anything you have already entered.

---

### Step 2 — Data

Upload your jsPsych data files (`.csv` or `.json`):

- Click **Choose folder** to browse for a directory (uses the browser's folder picker) **or** click **Upload zip** to upload a `.zip` containing your data files.
- Each file is shown with a status indicator once processed.
- If your data files contain nested arrays, the wizard detects whether `trial_index` uniquely identifies each row. If not, a join-key chooser lets you select additional columns before proceeding — these are used to name the separate CSV files the validator expects.

> **What the wizard does with your files:** JSON data is converted to Psych-DS-named CSV (e.g. `data/subject-sub01_data.csv`) so the validator and the downloaded zip both see compliant tables; your original JSON is preserved under `data/raw/`. CSV uploads are kept as-is. This conversion is what ends up in the downloaded zip.

> **For existing projects:** the Data step is pre-marked complete since your variables are already loaded from the uploaded `dataset_description.json`. You can still upload new data files to regenerate the variable list.

---

### Step 3 — Variables

Review and annotate each variable detected in your data:

- Variables with **unknown descriptions** (those the plugin cache could not fill in automatically) appear in an expanded section at the top.
- Known variables start collapsed. Use **Expand all / Collapse all** to open or close all rows at once.
- Each row has a **Description** text area and a **Type** dropdown. Editing either updates the metadata immediately.
- Long level lists are truncated at five entries with a **Show all N** toggle.

---

### Step 4 — Authors

Add contributors to the dataset:

- Click **Add author** to create a new row. Type a name and press Tab or click away to commit it.
- Expand a row to fill in optional fields: given name, family name, author type, ORCID.
- **Bulk import** lets you paste a list of names (one per line, optionally followed by an ORCID) to add multiple authors at once. Invalid ORCIDs are flagged with a warning banner.

---

### Step 5 — Review

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
- **Validate dataset** runs the Psych-DS validator entirely in your browser and lists any errors and warnings inline, each with the underlying rule key and the specific files/columns at fault. An internet connection is required — the validator fetches the Psych-DS schema and schema.org context at runtime.
  - Because in-browser validation only sees your metadata and data files, it may report missing `README` / `CHANGES` warnings. These are expected: the downloaded zip already includes `README.md` and `CHANGES.md`, so they clear when you validate the downloaded dataset (e.g. with `npx @jspsych/cli validate`).

The **{} Preview** pill button (visible on all steps except Review) opens a live JSON snapshot in a slide-in drawer so you can check the output at any point without leaving the current step.

---

## Building for production

```
npm run build
```

Output is written to `packages/frontend/dist/`. Serve it with any static file host.

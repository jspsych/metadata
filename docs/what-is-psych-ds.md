# What is Psych-DS?

[Psych-DS](https://psych-ds.github.io/) is a community data standard for psychology and behavioral science research. It defines a set of conventions for how datasets should be organized and documented — consistent folder structure, file naming rules, and a machine-readable description file that travels with your data.

This page explains what the standard involves and why it matters. For a hands-on guide to generating a Psych-DS compliant dataset from your jsPsych experiment, see [Getting Started](getting-started.md).

---

## The problem it solves

Most behavioral science labs develop their own conventions for organizing data files: a folder structure that made sense at the time, filenames that seemed clear to whoever made them, a README that may or may not still be accurate. This works fine within a lab, but creates friction everywhere else:

- A collaborator receives your data and spends days figuring out what each file contains.
- You return to a dataset six months later and can't reconstruct what the columns mean.
- A reviewer asks for raw data and your file structure doesn't match what the paper describes.
- A meta-analyst wants to include your study but can't parse your variable names automatically.

Psych-DS addresses this by giving datasets a predictable, documented structure that anyone — including software tools — can read without asking you questions first.

---

## The two core requirements

### 1. File organization

A Psych-DS compliant dataset has a specific folder layout:

```
my-experiment/
├── dataset_description.json    ← machine-readable metadata about the dataset
├── data/
│   └── task-flanker_data.csv   ← your data files, named to a standard pattern
└── data/raw/                   ← optional: original files in their earliest form
```

The `data/` folder holds your data files in CSV format. Each filename follows a `keyword-value_data.csv` pattern (e.g. `subject-01_data.csv`, `task-flanker_data.csv`) so that the role of each file is unambiguous. The `data/raw/` folder is for preserving originals — JSON exports, Excel workbooks, anything that isn't a clean CSV — and is ignored by the validator.

### 2. A metadata file

Every Psych-DS dataset includes a `dataset_description.json` file placed next to the `data/` folder. This is a JSON file that describes the dataset in a machine-readable way, using the [Schema.org](https://schema.org/) vocabulary so that the information is interpretable by any software that understands that standard.

At minimum it must include:

```json
{
  "@context": "https://schema.org/",
  "@type": "Dataset",
  "name": "Flanker Study",
  "description": "A description of the dataset.",
  "variableMeasured": ["trial_type", "rt", "correct", "stimulus"]
}
```

The `variableMeasured` field lists every column name that appears across all CSV files in the dataset. This is what makes the metadata machine-readable — a script or meta-analyst can open `dataset_description.json` and immediately know what variables the dataset contains, without opening a single data file.

Richer metadata — author information, variable descriptions, measurement units, links to publications — can also be included and makes the dataset significantly more useful to others.

---

## Why this matters for jsPsych experiments

jsPsych experiments produce structured tabular data, but the output files typically have ad-hoc names and no attached documentation. Psych-DS gives that data a standard home, and the `dataset_description.json` file is where the documentation lives.

Because jsPsych plugins have consistent, documented parameter names, it's possible to automatically generate much of the `variableMeasured` content by reading the data and looking up what each column means in the plugin that produced it. That's what the jsPsych Metadata CLI does — it reads your experiment output and generates a `dataset_description.json` populated with variable descriptions drawn from the jsPsych plugin documentation.

### How it ties into the rest of jsPsych

Metadata generation isn't a separate tool you have to bolt on afterward — it draws on the same jsPsych modules your experiment is already built from, and can run wherever your workflow lives:

- **In the browser, alongside your experiment.** The `@jspsych/metadata` library runs client-side, so an experiment can generate or update its own `dataset_description.json` at the moment data is collected, using the plugins it already loaded.
- **In Node or a build step.** The same library runs server-side to process data you've already collected, in batch.
- **From the command line.** The Metadata CLI wraps that library for researchers who just want to point at a folder of files.

In every case the variable descriptions come from the **same jsPsych plugin modules your experiment uses**. Because the plugin is the source of truth, the descriptions stay consistent with the plugin versions you actually ran — there's no separate data dictionary to maintain by hand.

---

## FAIR data principles

Psych-DS is designed to help datasets meet the [FAIR principles](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4792175/) — a widely adopted framework for scientific data that stands for **Findable, Accessible, Interoperable, and Reusable**. A dataset that follows Psych-DS conventions is easier to find (it has a structured description), easier to use by others (the format is predictable), and easier to integrate into meta-analyses and automated pipelines.

---

## Further reading

The official Psych-DS documentation covers the full specification in detail:

- [Getting Started Guide](https://psychds-docs.readthedocs.io/en/latest/guides/1_getting_started/) — a walkthrough of the standard for researchers organizing data manually
- [Rules and Conventions](https://psychds-docs.readthedocs.io/en/latest/reference/rules_and_conventions/) — complete specification of the naming rules and required fields
- [Web Validator](https://psych-ds.github.io/validator/) — check any local dataset against the standard in your browser, with no data uploaded

The jsPsych Metadata CLI automates the steps described in that getting started guide for jsPsych experiment data. See [Getting Started](getting-started.md) to try it.

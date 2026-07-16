---
title: Introduction
sidebar_label: Introduction
description: Generate Psych-DS compliant metadata for your jsPsych experiment data — in the browser or from the command line.
---

# Introduction

The [jsPsych metadata tools](https://github.com/jspsych/metadata) read your raw experiment data and produce a [Psych-DS](https://psychds-docs.readthedocs.io/en/latest/) compliant `dataset_description.json` — a machine-readable file that describes your experiment and its variables, so your data is easier to share, archive, and reuse.

:::tip
If you collect data with [DataPipe](https://pipe.jspsych.org/), you may not need these tools at all — DataPipe can generate the same metadata automatically in your OSF project as sessions are uploaded.
:::

## What is Psych-DS?

[Psych-DS](https://psychds-docs.readthedocs.io/en/latest/) is a community data standard for behavioral research. A compliant dataset needs two things:

1. **A standard folder layout** — data files live in a `data/` folder, named to a `keyword-value_data.csv` pattern (e.g. `subject-01_data.csv`) so each file's role is unambiguous.
2. **A `dataset_description.json`** — a [Schema.org](https://schema.org/) description that travels with the data, listing every variable (`variableMeasured`) and, ideally, what each one means.

Writing that description by hand is the tedious part. These tools automate it: they read your jsPsych data and look up what each column means from the **plugin that produced it**, so the descriptions stay consistent with the versions you actually ran — no data dictionary to maintain.

## Two ways to generate it

Both produce the same Psych-DS output — pick whichever fits how you work.

- **[Web wizard](/)** — the homepage of this site. Upload your data, fill in a few fields, and download a ready-to-share project, with validation built in. Nothing leaves your browser. Best if you prefer point-and-click. → [Using the wizard](./guides/using-the-wizard.mdx)
- **[Command-line tool](./guides/using-the-cli.mdx)** — reads a folder of data files and writes a Psych-DS project next to them. Best when your data is already on your machine, or you want to script generation into a pipeline. → [Using the CLI](./guides/using-the-cli.mdx)

Either way the flow is the same: give the dataset a name, upload your raw data, review the auto-detected variables, add authors, then validate and download. The [**Using the wizard**](./guides/using-the-wizard.mdx) and [**Using the CLI**](./guides/using-the-cli.mdx) guides walk through each step.

## What you get

Either path produces a self-contained project folder:

```
your-project/
├── data/                       your data, as Psych-DS compliant CSV
│   └── raw/                     your original files, untouched
├── dataset_description.json    the generated metadata
├── README.md                   placeholder for a description
└── CHANGES.md                  placeholder for a changelog
```

JSON and JSON-Lines inputs are converted to CSV (with originals kept under `data/raw/`); CSV inputs are used as-is.

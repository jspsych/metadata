---
title: What is Psych-DS?
sidebar_label: What is Psych-DS?
description: What the Psych-DS data standard is, what a compliant dataset looks like, and what the jsPsych metadata tools generate for you.
---

# What is Psych-DS?

[Psych-DS](https://psychds-docs.readthedocs.io/en/latest/) is a community data standard for behavioral research — a simple, agreed-upon way to lay out your data and describe it, so a dataset is understandable to other researchers and to software without any private explanation from you.

The [jsPsych metadata tools](https://github.com/jspsych/metadata) produce a Psych-DS compliant dataset from your raw experiment data. This page explains what that standard is and what the tools generate; when you're ready to make one, see [Using the wizard](./guides/using-the-wizard.mdx) or [Using the CLI](./guides/using-the-cli.mdx).

:::tip
If you collect data with [DataPipe](https://pipe.jspsych.org/), you may not need these tools at all — DataPipe can generate the same metadata automatically in your OSF project as sessions are uploaded.
:::

## The two pieces of a compliant dataset

A Psych-DS compliant dataset needs two things:

1. **A standard folder layout** — data files live in a `data/` folder, named to a `keyword-value_data.csv` pattern (e.g. `subject-01_data.csv`) so each file's role is unambiguous.
2. **A `dataset_description.json`** — a [Schema.org](https://schema.org/) description that travels with the data, listing every variable (`variableMeasured`) and, ideally, what each one means.

The `dataset_description.json` is the part that makes a folder of CSVs *self-describing*: it records the dataset's name, authors, and license, and — most usefully — a machine-readable entry for every column in your data.

## Where the variable descriptions come from

Writing that description by hand is the tedious part. These tools automate it: they read your jsPsych data and look up what each column means from the **plugin that produced it**, so the descriptions stay consistent with the plugin versions you actually ran — no data dictionary to maintain. Numeric columns also get a recorded value range, and categorical columns get their observed levels.

You can always add to or override what's generated — authors, a study description, custom variable notes — see [Customizing the output](./guides/customizing-output.md).

## What the tools produce

Either the wizard or the CLI produces the same self-contained project folder:

```
your-project/
├── data/                       your data, as Psych-DS compliant CSV
│   └── raw/                     your original files, untouched
├── dataset_description.json    the generated metadata
├── README.md                   placeholder for a description
└── CHANGES.md                  placeholder for a changelog
```

JSON and JSON-Lines inputs are converted to CSV (with originals kept under `data/raw/`); CSV inputs are used as-is.

## Generate one

- **[Open the web wizard](/wizard)** — do it in your browser, no install. → [Using the wizard](./guides/using-the-wizard.mdx)
- **Command line** — `npx @jspsych/metadata-cli`, easy to script. → [Using the CLI](./guides/using-the-cli.mdx)

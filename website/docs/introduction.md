---
title: What is Psych-DS?
sidebar_label: What is Psych-DS?
description: What the Psych-DS data standard is, what a compliant dataset looks like, and what the jsPsych metadata tools generate for you.
---

# What is Psych-DS?

[Psych-DS](https://psychds-docs.readthedocs.io/en/latest/) is a community standard for organizing and describing behavioral datasets so they are understandable to both researchers and software.

The [jsPsych metadata tools](https://github.com/jspsych/metadata) turn raw experiment exports into a Psych-DS–compliant dataset and automatically document the variables produced by your plugins.

Describing your data this way — a machine-readable file listing its variables, authors, and license that travels alongside the data — is what makes a dataset easy to share, archive, and reuse, and it is increasingly expected by journals and funders as part of open, [FAIR](https://www.go-fair.org/fair-principles/) data.

Psych-DS is a general standard, not limited to jsPsych: it has its own [specification](https://psychds-docs.readthedocs.io/en/latest/) and an official [web validator](https://psych-ds.github.io/validator/). These tools generate a compliant dataset for you and run that same validation, so you never have to apply the spec by hand.

:::tip
If you collect data with [DataPipe](https://pipe.jspsych.org/), you may not need these tools at all — DataPipe can generate the same metadata automatically in your OSF project as sessions are uploaded.
:::

## The two pieces of a compliant dataset

A Psych-DS compliant dataset needs two things:

1. **A standard folder layout** — data files live in a `data/` folder, named to a `keyword-value_data.csv` pattern (e.g. `subject-01_data.csv`) so each file's role is unambiguous.
2. **A `dataset_description.json`** — a [Schema.org](https://schema.org/) description that travels with the data, listing every variable (`variableMeasured`) and what each one means.

Each column in your data becomes one `variableMeasured` entry. A reaction-time column, for example:

```json
{
  "@type": "PropertyValue",
  "name": "rt",
  "description": "Response time in milliseconds, from stimulus onset to the participant's key press.",
  "minValue": 251,
  "maxValue": 4832
}
```

## Where the variable descriptions come from

Writing those descriptions by hand is the tedious part. These tools automate it: they read your jsPsych data and look up what each column means from the **plugin that produced it**, so the descriptions stay consistent with the plugin versions you actually ran. Numeric columns also get a recorded value range, and categorical columns get their observed levels. Columns the plugins don't cover are left for you to fill in.

You can always add to or override what's generated — authors, a study description, custom variable notes — see [Customizing the output](./guides/customizing-output.md).

## What the tools produce

Either the wizard or the CLI produces a self-contained Psych-DS project. At its core is your data plus the generated metadata:

```
your-project/
├── data/                       your data, as Psych-DS compliant CSV
└── dataset_description.json    the generated metadata
```

JSON and JSON-Lines exports are converted to CSV. Originals are preserved under `data/raw/` whenever the output is not a byte-for-byte, same-named copy of the input — converted JSON, re-serialised CSVs, and renamed CSVs alike; only a clean CSV kept verbatim under its own compliant name is not duplicated there. The project also includes placeholder `README.md` and `CHANGES.md` files — see [Using the CLI](./guides/using-the-cli.mdx) for the full layout.

## Get started

- **[Open the web wizard](/wizard)** — do it in your browser, no install. → [Using the wizard](./guides/using-the-wizard.mdx)
- **Command line** — `npx @jspsych/metadata-cli`, easy to script. → [Using the CLI](./guides/using-the-cli.mdx)

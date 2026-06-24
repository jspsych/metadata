# Getting Started

This project generates [Psych-DS](https://psych-ds.github.io/) compliant metadata for [jsPsych](https://www.jspsych.org/) experiments. It reads your raw experiment data and produces a `dataset_description.json` that describes your experiment and its variables, so your data is easier to share, archive, and reuse.

There are two ways to use it — both produce the same Psych-DS output. Pick whichever fits how you work.

## What is Psych-DS?

[Psych-DS](https://psych-ds.github.io/) is a community standard for organizing and documenting psychology datasets. A Psych-DS compliant dataset has a predictable folder structure and a machine-readable description file (`dataset_description.json`) that travels with the data, making it easier to share, archive, and reuse — by collaborators, reviewers, or your future self.

The hardest part of meeting the standard is writing that description file by hand. This tool automates it: it reads your jsPsych data files, figures out what each variable means by looking up the plugin that produced it, and writes the `dataset_description.json` for you.

For more background, see [What is Psych-DS?](what-is-psych-ds.md).

## Two ways to use it

### 🌐 Web wizard — no install

A point-and-click wizard that runs entirely in your browser. Upload your data, fill in a few fields, and download a ready-to-share Psych-DS project — including in-browser validation. Nothing to install; nothing leaves your computer.

→ **[Using the Web Wizard](using-the-frontend.md)**

### 💻 Command-line tool — for local folders and automation

A terminal tool that reads a folder of data files and writes a Psych-DS project next to them. Best when your data already lives on your machine, or when you want to script metadata generation as part of a pipeline.

→ **[CLI Guide](cli-guide.md)** for a step-by-step walkthrough, and the **[CLI Reference](cli-reference.md)** for flags, exit codes, and non-interactive use.

### Which should I pick?

Use the **web wizard** if you want the quickest start with no setup. Use the **CLI** if your data is already in a local folder, or you need to run metadata generation unattended (in a script, on a schedule, or on a remote machine).

## What you'll get

Either path produces a self-contained Psych-DS project folder:

```
your-project/
├── data/                       your data files, in Psych-DS compliant CSV form
│   └── raw/                     your original files, untouched
├── dataset_description.json    the generated metadata
├── README.md                   placeholder for a human-readable description
└── CHANGES.md                  placeholder for a changelog
```

Both tools accept jsPsych data as CSV, JSON, or JSON-Lines (`.jsonl`), and convert JSON/JSONL to CSV so the Psych-DS validator can read it. Your originals are always preserved under `data/raw/`.

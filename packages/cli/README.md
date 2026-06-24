# Metadata CLI

A command-line tool for generating [Psych-DS](https://psych-ds.github.io/) compliant metadata for jsPsych experiments. Given a folder of jsPsych data files, it produces a `dataset_description.json` that describes your experiment and its variables according to the Psych-DS standard.

## Quick start

**Node.js 18 or later is required.** Check with `node --version`; if you don't have it, install it from [nodejs.org](https://nodejs.org).

```
npx @jspsych/metadata-cli
```

Running the tool without any flags launches interactive mode, which walks you through each step — the recommended way to use it. Point it at a folder of jsPsych data files (`.csv`, `.json`, or `.jsonl`) and it builds a self-contained Psych-DS project:

```
my-experiment/
├── data/                         Psych-DS compliant CSV copies of your data
│   └── raw/                       your original files, untouched
├── dataset_description.json      generated Psych-DS metadata
├── README.md                     placeholder for a human-readable description
└── CHANGES.md                    placeholder for version tracking
```

## Documentation

The full guides live in the repository's [`docs/`](../../docs) folder:

- **[Getting Started](../../docs/getting-started.md)** — overview and which tool to use (CLI vs. the browser wizard).
- **[CLI Guide](../../docs/cli-guide.md)** — step-by-step walkthrough of an interactive run, accepted data formats, and file-renaming strategies.
- **[CLI Reference](../../docs/cli-reference.md)** — every flag, exit code, filename rule, and non-interactive (scripting) usage.
- **[Metadata Options](../../docs/metadata-options.md)** — the optional `.json` file for setting authors, descriptions, and other fields.
- **[What is Psych-DS?](../../docs/what-is-psych-ds.md)** — background on the standard.

## Running the CLI locally (development)

To run the CLI from source — for development or to modify it:

1. Clone the repository.
2. From the repo root, run `npm install`.
3. `cd packages/cli` and run `npm run build`.
4. Run `npx .` to launch the CLI.

See the [developer guide](../../docs/dev/cli-architecture.md) for the internal architecture.

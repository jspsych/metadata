# metadata

Tools for generating [Psych-DS](https://psych-ds.github.io/) compliant metadata for
[jsPsych](https://www.jspsych.org/) experiments. Point them at a folder of jsPsych data files
and they produce a `dataset_description.json` (plus, for the CLI, a ready-to-share
Psych-DS project) describing your experiment and its variables — no more hand-writing the
description file.

This is a monorepo (npm workspaces) with three packages:

| Package                                | Description                                                          |
| --------------------------------------- | ---------------------------------------------------------------------- |
| [`@jspsych/metadata`](packages/metadata) | Core library: reads jsPsych data and builds Psych-DS metadata.        |
| [`@jspsych/metadata-cli`](packages/cli)  | Terminal tool for local folders and scripted/automated pipelines.    |
| `frontend`                               | Browser wizard — upload data, fill in a few fields, download a project. |

## Quick start (CLI)

Requires Node.js 20 or later.

```
npx @jspsych/metadata-cli
```

Running it with no flags launches interactive mode, which walks you through pointing it at a
folder of jsPsych data files (`.csv`, `.json`, or `.jsonl`) and writes a self-contained
Psych-DS project alongside them (`data/`, `dataset_description.json`, `README.md`, `CHANGES.md`).

Prefer a browser? The web wizard needs no install — see
[Using the Web Wizard](docs/using-the-frontend.md).

## Documentation

- **[Getting Started](docs/getting-started.md)** — overview and which tool to use (CLI vs. web wizard).
- **[CLI Guide](docs/cli-guide.md)** — step-by-step walkthrough, accepted data formats, renaming strategies.
- **[CLI Reference](docs/cli-reference.md)** — flags, exit codes, filename rules, non-interactive usage.
- **[Using the Web Wizard](docs/using-the-frontend.md)** — the browser-based alternative to the CLI.
- **[Metadata Options](docs/metadata-options.md)** — the optional JSON file for authors, descriptions, etc.
- **[What is Psych-DS?](docs/what-is-psych-ds.md)** — background on the standard.

## Development

```
npm install         # from the repo root
npm run build       # build all packages
npm test            # run the full test suite (jest, all workspaces)
npm run typecheck   # tsc --noEmit / tsc -b across all packages
```

Each package also has its own `README.md` with package-specific instructions
([metadata](packages/metadata/README.md), [cli](packages/cli/README.md),
[frontend](packages/frontend/README.md)).

## Contributing

Issues and pull requests are welcome at
[github.com/jspsych/metadata](https://github.com/jspsych/metadata). Please make sure
`npm test` and `npm run typecheck` pass before opening a PR.

## License

MIT

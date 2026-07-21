# metadata

Tools for generating [Psych-DS](https://psych-ds.github.io/) compliant metadata for
[jsPsych](https://www.jspsych.org/) experiments. Point them at a folder of jsPsych data files
and they produce a `dataset_description.json` (plus, for the CLI, a ready-to-share
Psych-DS project) describing your experiment and its variables — no more hand-writing the
description file.

This is a monorepo (npm workspaces) with three packages:

| Package                                  | Description                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| [`@jspsych/metadata`](packages/metadata) | Core library: reads jsPsych data and builds Psych-DS metadata.           |
| [`@jspsych/metadata-cli`](packages/cli)  | Terminal tool for local folders and scripted/automated pipelines.        |
| [`frontend`](packages/frontend)          | Browser wizard — upload data, fill in a few fields, download a project.  |

## Quick start (CLI)

Requires Node.js 22 or later.

```
npx @jspsych/metadata-cli
```

Running it with no flags launches interactive mode, which walks you through pointing it at a
folder of jsPsych data files (`.csv`, `.json`, or `.jsonl`) and writes a self-contained
Psych-DS project alongside them (`data/`, `dataset_description.json`, `README.md`, `CHANGES.md`).

Prefer a browser? The web wizard needs no install — use it at
[metadata.jspsych.org/wizard](https://metadata.jspsych.org/wizard).

## Documentation

The docs site lives in [`website/`](./website) and is built with
[Docusaurus](https://docusaurus.io/) on the shared
[jsPsych docs theme](https://github.com/jspsych/jspsych-docs-theme). Once deployed it is
available at **https://metadata.jspsych.org**, with the web wizard (built from
[`packages/frontend`](./packages/frontend)) embedded at
[`/wizard`](https://metadata.jspsych.org/wizard). It covers:

- **What is Psych-DS?** — [what the standard is and what the tools generate](./website/docs/introduction.md).
- **Guides** — [using the wizard](./website/docs/guides/using-the-wizard.mdx), [using the CLI](./website/docs/guides/using-the-cli.mdx), and [customizing the output](./website/docs/guides/customizing-output.md) with an options file.
- **Reference** — the [CLI reference](./website/docs/reference/cli-reference.md) (flags, exit codes, filename rules).

### Running the docs locally

```bash
# From the repo root: install the workspaces and build the core library,
# so the wizard build can resolve the local @jspsych/metadata.
npm ci
npm run build --workspace=@jspsych/metadata

cd website
npm install
npm start      # dev server with hot reload
npm run build  # production build into website/build
```

`npm start` and `npm run build` automatically run `npm run build:wizard` first, which builds
the wizard from `packages/frontend` into `website/static/wizard-app/` (gitignored) so the
`/wizard` page can embed it.

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

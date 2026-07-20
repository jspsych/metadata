# metadata

Library and CLI tool to generate Psych-DS compliant metadata for jsPsych experiments.

## Documentation

The docs site lives in [`website/`](./website) and is built with [Docusaurus](https://docusaurus.io/) on the shared [jsPsych docs theme](https://github.com/jspsych/jspsych-docs-theme). Once deployed it will be available at **https://metadata.jspsych.org**. The homepage is a landing/overview page, and the metadata **web wizard** (built from [`packages/frontend`](./packages/frontend)) is embedded at [`/wizard`](https://metadata.jspsych.org/wizard), one click away in the top nav.

It covers:

- **What is Psych-DS?** — [what the Psych-DS standard is and what the tools generate](./website/docs/introduction.md).
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

`npm start` and `npm run build` automatically run `npm run build:wizard` first, which builds the wizard from `packages/frontend` into `website/static/wizard-app/` (gitignored) so the `/wizard` page can embed it.

## Packages

- [`packages/metadata`](./packages/metadata) (`@jspsych/metadata`) — the core library.
- [`packages/cli`](./packages/cli) (`@jspsych/metadata-cli`) — the interactive CLI.
- [`packages/frontend`](./packages/frontend) — the browser-based web wizard.

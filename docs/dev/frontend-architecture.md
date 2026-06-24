# Frontend Package — Developer Guide

This document describes the internal architecture of `packages/frontend` for contributors who want to understand, modify, or extend the web wizard.

For user-facing documentation, see the [README](../../packages/frontend/README.md).

---

## Source structure

```
packages/frontend/
├── index.html              — HTML shell; inline script sets data-theme before first paint
├── src/
│   ├── main.tsx            — React root mount
│   ├── App.tsx             — top-level routing (landing ↔ wizard), theme toggle, JsPsychMetadata instance
│   ├── index.css           — global CSS custom properties (design tokens), dark theme overrides, scrollbar
│   ├── datasetLayout.ts    — shared constants: DATASET_DESCRIPTION_FILENAME, dataFilePath()
│   │
│   ├── pages/
│   │   ├── Landing.tsx/.module.css     — welcome screen (new vs. existing project)
│   │   ├── ProjectInfo.tsx/.module.css — step 1: dataset name, description, optional fields
│   │   ├── DataUpload.tsx/.module.css  — step 2: folder/zip picker, join-key chooser
│   │   ├── Variables.tsx/.module.css   — step 3: variable list with descriptions and types
│   │   ├── Authors.tsx/.module.css     — step 4: author cards, bulk import
│   │   └── Review.tsx/.module.css      — step 5: JSON viewer, download, in-browser validation
│   │
│   ├── components/
│   │   ├── AppShell.tsx/.module.css    — wizard frame: sidebar + content area + preview pill
│   │   ├── Sidebar.tsx/.module.css     — step navigation, Start Over dialog
│   │   ├── PageHeader.tsx/.module.css  — fixed page header shared by all wizard pages
│   │   ├── PreviewDrawer.tsx/.module.css — slide-in live JSON snapshot drawer
│   │   └── JsonViewer.tsx/.module.css  — syntax-highlighted collapsible JSON renderer
│   │
│   ├── hooks/
│   │   └── useTheme.ts     — dark/light theme: reads localStorage, falls back to OS preference
│   │
│   └── validation/         — in-browser Psych-DS validation (see "In-browser validation" below)
│       ├── validatePsychDS.ts          — wraps psychds-validator's web build
│       ├── psychds-validator-web.d.ts  — local types for the web bundle
│       └── node-stub.ts                — Node-only shim so the bundle resolves under Jest
```

> **Note:** the original modal-chain files (`pages/Upload.tsx`, `pages/Options.tsx`, `pages/ViewOptions.tsx`, `components/ListItems.tsx`, `components/Preview.tsx`, `components/popups/`, `components/upload/`, `useExternalScripts.ts`, and `App.css`) have been removed; the redesigned wizard described here is the only active architecture.

---

## Entry point and top-level routing

```
index.html
  └─ main.tsx  →  App.tsx
                    ├─ page === 'landing'  →  Landing
                    └─ page === 'main'     →  AppShell
```

`App.tsx` owns three things that outlive any single wizard step:

| State | Type | Purpose |
|-------|------|---------|
| `page` | `'landing' \| 'main'` | Which top-level view is shown |
| `jsPsychMetadata` | `JsPsychMetadata` | Single instance shared across all wizard steps |
| `existingMetadataFile` | `File \| undefined` | Set when the user uploads a `dataset_description.json` on Landing |

`handleStartOver` resets both `jsPsychMetadata` (new instance) and `existingMetadataFile`, then returns to `'landing'`. The theme toggle is rendered at `App` level so it persists across both views.

---

## Wizard state — AppShell

`AppShell` manages the five-step wizard. Its key state:

| State | Type | Purpose |
|-------|------|---------|
| `currentStep` | `StepId` | Which page is rendered in the content area |
| `completedSteps` | `Set<StepId>` | Gates sidebar navigation |
| `dataProcessed` | `boolean` | Whether `metadata.generate()` has been called at least once |
| `dataSession` | `DataSession` | File references + texts from the Data step (persisted for Review) |
| `projectInfoSession` | `ProjectInfoSession` | Field values from the Project Info step (persisted across re-renders) |
| `previewOpen` | `boolean` | Whether the Preview drawer is open |

### Step progression

`completeStep(stepId)` adds the step to `completedSteps` then navigates forward to the first step that is not yet complete — skipping any steps pre-completed on load (e.g. the Data step is pre-completed for existing projects, so `completeStep('projectInfo')` jumps straight to Variables).

`canNavigateTo(stepId)` returns `true` if the immediately preceding step is in `completedSteps`. The first step is always navigable. This means users can freely navigate back to any completed step but cannot skip forward.

### Session objects

Each stateful page (ProjectInfo, DataUpload) owns a "session" — a plain object holding UI state that should survive navigating away and back. The session and its setter are passed down from AppShell, not owned by the page component. This means the page re-renders with restored state when the user navigates back.

```ts
// DataUpload receives:
session: DataSession          // current values
onSessionChange: (s) => void  // update callback
```

`DataSession` holds the uploaded `File` objects and their text content (for passing to Review). `ProjectInfoSession` holds the form field values so they are not reset if the user steps back.

---

## Component breakdown

### `Sidebar`

Renders the left navigation rail. Receives `steps`, `currentStep`, `completedSteps`, `canNavigateTo`, `onNavigate`, and `onStartOver` as props — it owns no metadata state.

The Start Over confirmation uses a native `<dialog>` (opened via `showModal()` with `useLayoutEffect`) for free focus trap and Escape key handling. The dialog is conditionally rendered (only in the DOM when `confirming === true`) to avoid a CSS `display: flex` / UA `display: none` conflict.

### `PageHeader`

A `position: fixed` header shared by all wizard pages, sitting flush to the top of the viewport and starting at `var(--sidebar-w)` from the left. Accepts a `title` and an optional `right` slot for page-specific controls. All wizard pages use it via composition rather than duplicating a sticky header.

### `PreviewDrawer`

A 420px slide-in panel (fixed, right edge) that renders a live JSON snapshot via `JsonViewer`. Opened by the `{} Preview` pill button in `AppShell`. Mounts fresh on each open — intentional, so the snapshot reflects the exact metadata state at the moment you click Preview rather than auto-updating as you type.

### `JsonViewer`

A recursive collapsible renderer for arbitrary JSON. Keys, strings, numbers, booleans, and null each get their own CSS class for syntax colouring (see `JsonViewer.module.css`). Arrays and objects render a toggle button to collapse their contents.

---

## Data conversion pipeline (DataUpload)

The validator and the downloadable zip both expect Psych-DS-compliant CSV data files, so `DataUpload.tsx` converts uploaded data **before** anything reaches Review. For each file it calls `jsPsychMetadata.generate()` to accumulate variable metadata, then builds the converted payload using library exports re-used from `@jspsych/metadata` (`buildPsychDSDataFiles`, `parseCSV`, `parseJsonData`, `analyzeJoinKeys`, `deriveFallbackBase`, `isValidPsychDSDataFilename`, `PSYCHDS_IGNORE_FILENAME`, `PSYCHDS_IGNORE_CONTENT`):

- **JSON arrays** are serialized to Psych-DS-named CSV (e.g. `data/subject-sub01_data.csv`); the original JSON is preserved under `data/raw/<name>`.
- **CSV** input is written verbatim (an already-compliant filename is kept; otherwise a `subject-<stem>` base is derived). Rows are still parsed so R-style **unnamed row-index columns** can be dropped.
- **Non-array JSON** is skipped.
- When raw originals are kept, a top-level **`.psychds-ignore`** file (`PSYCHDS_IGNORE_FILENAME` / `PSYCHDS_IGNORE_CONTENT`) is added so the validator skips `data/raw/`.
- If a file has **nested arrays** and `trial_index` doesn't uniquely identify rows, a join-key chooser collects extra columns (via `analyzeJoinKeys`) before conversion.

The result is a `convertedFiles` map (dataset-relative path → contents) carried in the `DataSession` and handed to `Review` as `dataFiles`. It drives both validation and the zip, so the two always agree.

---

## In-browser validation

`Review.tsx` validates **post-generation**, on demand, behind a **"Validate dataset"** button — the implementation behind issue #3. The validator chunk is **lazy-loaded** (`await import('../validation/validatePsychDS')`, ~260 KB) so it stays out of the initial bundle.

`validatePsychDS(metadataJson, dataFiles)` (in `src/validation/validatePsychDS.ts`):

1. Ensures `jsonld` is on `window` (`ensureJsonldGlobal`) — the validator's browser path expects it as a global.
2. Builds a `WebFileTree` from `dataset_description.json` plus the converted `data/` payload (`buildFileTree` / `insertFile`).
3. Calls `validateWeb(tree, { schema: 'latest' })` from `psychds-validator/web`. `'latest'` (not a pinned version) keeps results consistent with the CLI and deployed web validator and avoids requesting a schema version the server may not have.
4. Splits the returned issues into `errors` / `warnings` by `severity`, deduping each issue's per-file `evidence` (e.g. the offending column names), and returns `{ valid, errors, warnings }`.

**Network is required** — the validator fetches the Psych-DS schema and schema.org context at runtime. If it can't run, `validatePsychDS` throws `ValidationUnavailableError` with a connectivity-first message (underlying error appended), which Review surfaces as an `unavailable` banner rather than a false "invalid" result.

**Zip-resolved warnings:** the in-browser validator only sees the metadata + data files, so it reports `MISSING_README_DOC` / `MISSING_CHANGES_DOC`. The downloaded zip ships `README.md` and `CHANGES.md`, so Review (`ZIP_RESOLVED_WARNINGS`) shows a reassurance note explaining these clear once the downloaded dataset is validated. A `<details>` block also documents the CLI equivalent (`npx @jspsych/cli validate`).

> The core `@jspsych/metadata` library does **not** validate — validation is a consuming concern owned by the frontend (here) and the CLI (`packages/cli/src/validatefunctions.ts`). Unit tests for these helpers are tracked in issue #94.

---

## Design system

### CSS Modules

Every component uses a co-located `.module.css` file. Class names are locally scoped by Vite's CSS Modules transform. Global CSS (design tokens, scrollbar, theme toggle button) lives in `src/index.css`.

For applying a global selector inside a module (e.g. targeting `[data-theme="dark"]`), use `:global(...)`:
```css
:global([data-theme="dark"]) .myClass { color: red; }
```

### Design tokens (`index.css`)

All colours are CSS custom properties on `:root`. Dark-mode overrides are on `:root[data-theme="dark"]`. `index.html` contains an inline script that sets `data-theme` synchronously before first paint, so there is no flash of the wrong theme.

Key token groups:

| Prefix | Purpose |
|--------|---------|
| `--c-forest-*` | Brand greens (progress indicators, completed checkmarks) |
| `--c-amber*` | Amber (forward-progress CTA buttons only) |
| `--c-ink*` | Text hierarchy (`--c-ink` → `--c-ink-4`, darkest to lightest in light mode) |
| `--c-bg*` | Surface colours (page, sidebar, raised card, input) |
| `--c-border*` | Border colours (standard and subtle) |
| `--c-badge-*`, `--c-success-*`, `--c-warn-*`, `--c-danger-*` | Semantic status colours |
| `--sidebar-w` | `211px` — sidebar width including its right border; used by `PageHeader` and `PreviewDrawer` |

### `useTheme`

`src/hooks/useTheme.ts` reads `localStorage.getItem('theme')`, falls back to `window.matchMedia('(prefers-color-scheme: dark)')`, and sets `document.documentElement.dataset.theme` in a `useEffect`. It exports `{ isDark, toggle }`. The inline script in `index.html` mirrors this logic synchronously so CSS loads with the right token values immediately.

### Input style

Inputs use a hybrid underline style: `1px solid` on all four sides normally, with only the bottom border activating on focus (`2px solid var(--c-forest-bright)` with a directional glow). This is defined in each page's module CSS rather than globally.

---

## `@jspsych/metadata` API used by the frontend

The wizard uses a single `JsPsychMetadata` instance created in `App.tsx` and passed to every step.

| Method | Step | Purpose |
|--------|------|---------|
| `loadMetadata(jsonString)` | ProjectInfo | Load an existing `dataset_description.json` |
| `setMetadataField(key, value)` | ProjectInfo | Write name, description, license, etc. |
| `getMetadataField(key)` | ProjectInfo | Read back field values to pre-fill the form |
| `generate(content, {}, format, options)` | DataUpload | Parse a data file and accumulate variable metadata |
| `getVariableList()` | Variables | Get all variable objects for display |
| `getVariableNames()` | Variables | List variable names |
| `getVariable(name)` | Variables | Read a single variable's metadata |
| `updateVariable(name, key, value)` | Variables | Write user-edited description or type |
| `getAuthorList()` | Authors | Read existing authors (for pre-filling on existing projects) |
| `setAuthor(fields)` | Authors | Add or update an author entry (single `AuthorFields` object; keyed by `name`) |
| `deleteAuthor(name)` | Authors | Remove an author |
| `getMetadata()` | Review | Serialize the full metadata object to JSON |

Beyond the `JsPsychMetadata` instance, `DataUpload` also imports standalone helpers from `@jspsych/metadata` to build the Psych-DS `data/` payload — `buildPsychDSDataFiles`, `parseCSV`, `parseJsonData`, `analyzeJoinKeys`, `deriveFallbackBase`, `isValidPsychDSDataFilename`, and the `PSYCHDS_IGNORE_*` constants (see [Data conversion pipeline](#data-conversion-pipeline-dataupload)). In-browser validation uses `psychds-validator` directly, not the library (see [In-browser validation](#in-browser-validation)).

---

## Running the tests

```
cd packages/frontend
npm test
```

Tests live in `packages/frontend/tests/` and use Jest + jsdom + Testing Library. The `psychds-validator/web/` bundle is mocked via `moduleNameMapper` (Node cannot load it — it is blocked by the package's exports map). `@jspsych/metadata` is mapped to its `src/` directory so tests run without a prior build.

---

## Development workflow

```bash
# from repo root
npm install

# run the frontend dev server
cd packages/frontend
npm run dev        # http://localhost:5173

# type-check + production build → dist/
npm run build

# lint
npm run lint
```

The metadata package is a local workspace dependency resolved from `packages/metadata/src` at dev time — no separate build step needed when iterating on the metadata package alongside the frontend.

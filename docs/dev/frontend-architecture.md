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
│   └── validation/         — in-browser Psych-DS validation (added by feat/frontend-validator)
│       ├── validatePsychDS.ts
│       ├── psychds-validator-web.d.ts
│       └── node-stub.ts
```

> **Legacy files still present:** `App.css`, `pages/Upload.tsx`, `pages/Options.tsx`, `pages/ViewOptions.tsx`, `components/ListItems.tsx`, `components/Preview.tsx`, `components/popups/`, `components/upload/`, `useExternalScripts.ts`. These are from the original modal-chain architecture and are no longer imported by any active code. They can be removed once the redesign is confirmed stable.

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
| `getVariables()` | Variables | Get the full variable map for display |
| `getVariableNames()` | Variables | List variable names |
| `getVariable(name)` | Variables | Read a single variable's metadata |
| `updateVariable(name, key, value)` | Variables | Write user-edited description or type |
| `getAuthorList()` | Authors | Read existing authors (for pre-filling on existing projects) |
| `setAuthor(name, data)` | Authors | Add or update an author entry |
| `removeAuthor(name)` | Authors | Remove an author |
| `getMetadata()` | Review | Serialize the full metadata object to JSON |

---

## Running the tests

```
cd packages/frontend
npm test
```

Tests live in `packages/frontend/tests/` and use Jest + jsdom + Testing Library. See PR #96 for the full setup. The `psychds-validator/web/` bundle is mocked via `moduleNameMapper` (Node cannot load it — it is blocked by the package's exports map). `@jspsych/metadata` is mapped to its `src/` directory so tests run without a prior build.

---

## Development workflow

```bash
# from repo root
npm install

# run the frontend dev server
cd packages/frontend
npm run dev        # http://localhost:5173

# type-check only (does not run Vite)
npm run build

# lint
npm run lint
```

The metadata package is referenced as a local workspace dependency (`@jspsych/metadata: ^0.0.3`) and resolved from `packages/metadata/src` at dev time — no separate build step needed when iterating on the metadata package alongside the frontend.

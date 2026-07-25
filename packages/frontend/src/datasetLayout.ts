// Shared knowledge about how a Psych-DS dataset is laid out, used by both the
// Review download (zip) and the in-browser validator so the two never drift.
//
// The `data/` payload itself (converted, Psych-DS-named CSVs and preserved raw JSON) is built
// during upload in DataUpload.tsx via @jspsych/metadata's buildPsychDSDataFiles, and its keys
// are already dataset-relative paths — so no path mapping is needed here anymore.

/** Canonical Psych-DS metadata filename. */
export const DATASET_DESCRIPTION_FILENAME = 'dataset_description.json';

const README_FILENAME = 'README.md';
const CHANGES_FILENAME = 'CHANGES.md';

const readmeContents = (projectName: string): string =>
  `# ${projectName}\nHuman-readable description of the project and dataset.`;

const CHANGES_CONTENTS =
  'For version tracking — if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.';

/**
 * The placeholder docs Psych-DS recommends at the dataset root. The zip writes these into every
 * download, and the in-browser validator is handed the same two files — otherwise it reports
 * MISSING_README_DOC / MISSING_CHANGES_DOC against a project that will in fact contain them, and
 * the user is left reading a warning about a problem that does not exist.
 *
 * Both Psych-DS rules are presence-only (stem + extension at the dataset root, no content
 * requirements), so supplying the same bytes the download carries is an honest check, not a
 * suppression. Callers must only include these when a zip is actually being produced: with no
 * data files the user saves the bare metadata JSON, and the warnings are then real.
 */
export const datasetDocs = (projectName: string): { path: string; contents: string }[] => [
  { path: README_FILENAME, contents: readmeContents(projectName) },
  { path: CHANGES_FILENAME, contents: CHANGES_CONTENTS },
];

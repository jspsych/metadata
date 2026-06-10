import jsonld from 'jsonld';
import {
  validateWeb,
  type WebFileTree,
} from 'psychds-validator/web/psychds-validator.js';

const FILENAME = 'dataset_description.json';

export interface ValidationIssue {
  key: string;
  reason: string;
  /** Per-file detail from the validator (e.g. the specific column names at fault). */
  evidence: string[];
}

export interface PsychDSValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** Thrown when validation can't run at all (e.g. the schema can't be fetched). */
export class ValidationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationUnavailableError';
  }
}

/**
 * The validator's browser path expects jsonld as a global (`window.jsonld`),
 * mirroring how the deployed Psych-DS validator loads it. The npm package's
 * `browser` field makes this the browser build under Vite.
 */
function ensureJsonldGlobal() {
  const w = window as unknown as { jsonld?: unknown };
  if (!w.jsonld) w.jsonld = jsonld;
}

/**
 * Mirrors Review's zip layout: dataset_description.json at the root and every
 * data file under a `data/` directory, with the top-level export folder
 * stripped (e.g. "my-experiment/sub01.csv" -> "data/sub01.csv").
 */
function dataFilePath(originalPath: string): string {
  const parts = originalPath.split('/');
  const relative = parts.length > 1 ? parts.slice(1).join('/') : originalPath;
  return `data/${relative}`;
}

/** Inserts a `/`-separated path into the nested file-tree dict, creating dirs. */
function insertFile(tree: WebFileTree, path: string, content: string) {
  const segments = path.split('/').filter(Boolean);
  const filename = segments.pop();
  if (!filename) return;

  let dir = tree;
  for (const segment of segments) {
    let node = dir[segment];
    if (!node || node.type !== 'directory') {
      node = { type: 'directory', contents: {} };
      dir[segment] = node;
    }
    dir = node.contents;
  }
  dir[filename] = { type: 'file', file: new Blob([content]) };
}

function buildFileTree(
  metadataJson: string,
  dataFiles?: Map<string, string>,
): WebFileTree {
  const tree: WebFileTree = {
    [FILENAME]: { type: 'file', file: new Blob([metadataJson]) },
  };
  if (dataFiles) {
    for (const [originalPath, content] of dataFiles) {
      insertFile(tree, dataFilePath(originalPath), content);
    }
  }
  return tree;
}

/**
 * Runs the Psych-DS validator entirely in the browser against the generated
 * metadata plus the user's data files. Requires network access — the validator
 * fetches the Psych-DS schema and schema.org context at runtime.
 *
 * @param metadataJson  Serialized dataset_description.json.
 * @param dataFiles     Map of original file path -> text content (CSV/JSON).
 */
export async function validatePsychDS(
  metadataJson: string,
  dataFiles?: Map<string, string>,
): Promise<PsychDSValidationResult> {
  ensureJsonldGlobal();

  const tree = buildFileTree(metadataJson, dataFiles);

  let output;
  try {
    output = await validateWeb(tree, { schema: 'latest' });
  } catch (err) {
    console.error('Psych-DS validation could not run:', err);
    throw new ValidationUnavailableError(
      'The validator could not run. It needs an internet connection to fetch ' +
        'the Psych-DS schema — check your connection and try again.',
    );
  }

  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  for (const [, issue] of output.issues) {
    // Each issue carries per-file evidence (e.g. the exact offending column
    // names) — dedupe and keep it so the UI can show what actually failed.
    const evidence = [
      ...new Set(
        [...issue.files.values()]
          .map((file) => file?.evidence?.trim())
          .filter((e): e is string => Boolean(e)),
      ),
    ];
    const entry: ValidationIssue = { key: issue.key, reason: issue.reason, evidence };
    if (issue.severity === 'error') errors.push(entry);
    else if (issue.severity === 'warning') warnings.push(entry);
  }

  return { valid: errors.length === 0, errors, warnings };
}

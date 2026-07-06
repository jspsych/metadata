import os from 'os';
import path from 'path';

export function expandHomeDir(directoryPath: string): string {
  // Only expand a bare "~" or a leading "~/" (or "~\" on Windows). A "~username"
  // path refers to *another* user's home directory, which os.homedir() cannot
  // resolve — expanding it would mangle the path (e.g. "~bob/x" → "<me>/bob/x"),
  // so it is left untouched for the OS to handle.
  if (directoryPath === '~') return os.homedir();
  if (directoryPath.startsWith('~/') || directoryPath.startsWith('~\\')) {
    return path.join(os.homedir(), directoryPath.slice(1));
  }
  return directoryPath;
}

/**
 * Validates a project name entered at the prompt: it becomes a folder name and a metadata
 * field, so it must be non-empty and free of path separators (which would create/redirect
 * directories). Pure so it can be unit-tested and reused by the prompt's `validate` hook.
 * Returns `true` when valid, else a human-readable error message.
 */
export function validateProjectName(name: string): true | string {
  if (name.trim().length === 0) return 'Project name cannot be empty.';
  if (/[\\/]/.test(name)) return 'Project name cannot contain path separators ("/" or "\\").';
  return true;
}

/**
 * The "stem" of a source file: its basename minus the extension and a trailing `_data`.
 * For an already-compliant file this is its Psych-DS base (the keyword-value sequence):
 *   "subject-1_data.csv" → "subject-1",  "experiment.json" → "experiment".
 */
export function fileStem(file: string): string {
  return path.basename(file, path.extname(file)).replace(/_data$/i, '');
}

/**
 * Generic filename disambiguation: returns `name` unchanged when free, otherwise inserts
 * a counter before the extension (e.g. data.json → data2.json) until a free name is found.
 * Used for the preserved raw originals under data/raw/, whose basenames are not Psych-DS
 * names and so are not constrained by the [a-zA-Z0-9] value rule.
 */
export function disambiguateFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;

  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  let n = 2;
  let candidate = `${stem}${n}${ext}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${stem}${n}${ext}`;
  }
  return candidate;
}
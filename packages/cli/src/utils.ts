import os from 'os';
import path from 'path';

export function expandHomeDir(directoryPath: string): string {
  if (directoryPath.startsWith('~')) {
    const homeDir = os.homedir();
    return path.join(homeDir, directoryPath.slice(1));
  }
  return directoryPath;
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
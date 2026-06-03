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
 * Full Psych-DS data filename pattern, mirroring psychds-validator's fileRegex:
 * one or more `keyword-value` pairs (keyword: lowercase letters only; value:
 * alphanumeric, any case) joined by `_`, ending in `_data.csv` (or `.tsv`).
 * Anything else fails validation with a FILENAME_KEYWORD_FORMATTING_ERROR.
 */
const PSYCH_DS_FILENAME_RE = /^([a-z]+-[a-zA-Z0-9]+)(_[a-z]+-[a-zA-Z0-9]+)*_data\.(csv|tsv)$/;

/** True if `name` is a fully Psych-DS-compliant data filename. */
export function isValidPsychDSDataFilename(name: string): boolean {
  return PSYCH_DS_FILENAME_RE.test(name);
}

/**
 * Coerces an arbitrary string into a Psych-DS *value* segment ([a-zA-Z0-9]+).
 * Psych-DS values forbid hyphens and underscores, so every run of non-alphanumeric
 * characters is treated as a word boundary, removed, and the following word
 * capitalised — yielding camelCase so meaning survives:
 *   "mouse_tracking" → "mouseTracking", "subject1" → "subject1", "RT (ms)" → "RTMs".
 * Returns `fallback` when the input has no alphanumeric characters.
 */
export function toPsychDSValue(name: string, fallback = 'value'): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
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
 * Derives the Psych-DS filename for an extracted-array CSV from its parent file's
 * already-normalized base plus the column name:
 *   base "subject-subject1" + column "mouse_tracking"
 *     → "subject-subject1_measure-mouseTracking_data.csv"
 * "measure" is an unofficial Psych-DS keyword: it triggers a validator *warning*
 * (not an error), used because no official keyword describes a per-column sub-table.
 */
export function deriveArrayFilename(parentBase: string, columnName: string): string {
  return `${parentBase}_measure-${toPsychDSValue(columnName, 'col')}_data.csv`;
}

/**
 * Serialises an array of objects to RFC 4180 CSV. Nested objects/arrays in a cell
 * are serialised as JSON strings so no data is lost.
 * trial_index and element_index columns are placed first; remaining columns
 * follow in the order they first appear across all rows.
 */
export function objectsToCSV(rows: Array<Record<string, any>>, priorityCols: string[] = ['trial_index', 'element_index']): string {
  if (rows.length === 0) return '';

  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) allKeys.add(key);
  }
  const otherCols = [...allKeys].filter(k => !priorityCols.includes(k));
  const headers = [...priorityCols.filter(c => allKeys.has(c)), ...otherCols];

  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    // Preserve nested objects/arrays as JSON strings so no data is lost.
    // (String(val) would collapse them to "[object Object]".)
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Returns a filename not already present in `used`. If `base` is free it is returned
 * as-is; otherwise a counter is appended directly to the final value
 * (e.g. foo_measure-bar_data.csv → foo_measure-bar2_data.csv) until a free name is found.
 *
 * The counter is appended with no separator on purpose: a hyphen or underscore would
 * split into an extra/invalid keyword-value pair and fail the Psych-DS filename regex
 * (values must be [a-zA-Z0-9]+). Distinct source files / columns can normalize to the
 * same name (camelCase coercion is lossy, and only the basename is used), and since all
 * outputs land in one flat directory this prevents one from silently overwriting another.
 */
export function disambiguateArrayFilename(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;

  const suffix = '_data.csv';
  const root = base.endsWith(suffix) ? base.slice(0, -suffix.length) : base.replace(/\.csv$/i, '');
  let n = 2;
  let candidate = `${root}${n}${suffix}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${root}${n}${suffix}`;
  }
  return candidate;
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
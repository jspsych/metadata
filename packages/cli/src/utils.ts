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
 * Converts a column name or file stem to a Psych-DS safe value segment:
 * lowercased; spaces, underscores, periods, and any other non-alphanumeric-hyphen
 * characters replaced with hyphens; runs of hyphens collapsed to one.
 */
export function sanitizePsychDSSegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Derives the Psych-DS compliant output filename for a separate array CSV.
 * Pattern: strip extension, strip trailing _data, sanitize, append _measure-{col}_data.csv
 *
 * "measure" is used as the key (rather than a structural label like "column") to align
 * with the Psych-DS / schema.org convention of describing data by what is measured.
 *
 * Examples:
 *   participant-001_session-1_data.csv + mouse_tracking_data
 *     → participant-001_session-1_measure-mouse-tracking-data_data.csv
 *   Keyboard Response.csv + response
 *     → keyboard-response_measure-response_data.csv
 *   stem + validation_data.pointData
 *     → stem_measure-validation-data-pointdata_data.csv
 */
export function deriveArrayFilename(sourceFile: string, columnName: string): string {
  const stem = path.basename(sourceFile, path.extname(sourceFile));
  const withoutData = stem.replace(/_data$/i, '');
  const safeStem = sanitizePsychDSSegment(withoutData);
  const safeCol = sanitizePsychDSSegment(columnName);
  return `${safeStem}_measure-${safeCol}_data.csv`;
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
 * as-is; otherwise a numeric suffix is inserted into the measure segment
 * (e.g. foo_measure-bar_data.csv → foo_measure-bar-2_data.csv) until a free name is found.
 *
 * deriveArrayFilename is a lossy, many-to-one mapping (sanitization collapses separators,
 * and only the basename is used), so distinct source files / columns can produce the same
 * name. Since all extracted CSVs are written to a single flat directory, this prevents one
 * from silently overwriting another.
 */
export function disambiguateArrayFilename(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;

  const suffix = '_data.csv';
  const root = base.endsWith(suffix) ? base.slice(0, -suffix.length) : base.replace(/\.csv$/i, '');
  let n = 2;
  let candidate = `${root}-${n}${suffix}`;
  while (used.has(candidate)) {
    n += 1;
    candidate = `${root}-${n}${suffix}`;
  }
  return candidate;
}
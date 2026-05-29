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
 * Serialises an array of flat objects to RFC 4180 CSV.
 * trial_index and element_index columns are placed first; remaining columns
 * follow in the order they first appear across all rows.
 */
export function objectsToCSV(rows: Array<Record<string, any>>): string {
  if (rows.length === 0) return '';

  const priorityCols = ['trial_index', 'element_index'];
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) allKeys.add(key);
  }
  const otherCols = [...allKeys].filter(k => !priorityCols.includes(k));
  const headers = [...priorityCols.filter(c => allKeys.has(c)), ...otherCols];

  const escape = (val: any): string => {
    const str = val === null || val === undefined ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => escape(row[h])).join(','));
  }
  return lines.join('\r\n');
}
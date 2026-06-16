import { parse } from 'csv-parse';

// private function to save text file on local drive
export function saveTextToFile(textstr: string, filename: string) {
  const blobToSave = new Blob([textstr], {
    type: "text/plain",
  });
  let blobURL = "";
  if (typeof window.webkitURL !== "undefined") {
    blobURL = window.webkitURL.createObjectURL(blobToSave);
  } else {
    blobURL = window.URL.createObjectURL(blobToSave);
  }

  const link = document.createElement("a");
  link.id = "jspsych-download-as-text-link";
  link.style.display = "none";
  link.download = filename;
  link.href = blobURL;
  link.click();
}

// this function based on code suggested by StackOverflow users:
// http://stackoverflow.com/users/64741/zachary
// http://stackoverflow.com/users/317/joseph-sturtevant

export function JSON2CSV(objArray) {
  const array = typeof objArray != "object" ? JSON.parse(objArray) : objArray;
  let line = "";
  let result = "";
  const columns = [];

  for (const row of array) {
    for (const key in row) {
      let keyString = key + "";
      keyString = '"' + keyString.replace(/"/g, '""') + '",';
      if (!columns.includes(key)) {
        columns.push(key);
        line += keyString;
      }
    }
  }

  line = line.slice(0, -1); // removes last comma
  result += line + "\r\n";

  for (const row of array) {
    line = "";
    for (const col of columns) {
      let value = typeof row[col] === "undefined" ? "" : row[col];
      if (typeof value == "object") {
        value = JSON.stringify(value);
      }
      const valueString = value + "";
      line += '"' + valueString.replace(/"/g, '""') + '",';
    }

    line = line.slice(0, -1);
    result += line + "\r\n";
  }

  return result;
}

export function tryParseJSON(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** System columns excluded from join-key candidate detection; also used to initialise ignored_variables in JsPsychMetadata. */
export const SYSTEM_COLUMNS = new Set([
  'trial_type', 'trial_index', 'time_elapsed', 'extension_type', 'extension_version',
]);

export interface JoinKeyAnalysis {
  isUnique: boolean;
  duplicateCount: number;
  /** Up to 5 example key-value maps for rows that share a composite key. */
  duplicateValues: Array<Record<string, any>>;
  /** All non-system, non-selected columns, categorised by whether adding them alone achieves uniqueness. */
  candidates: Array<{ column: string; makesUnique: boolean }>;
  /**
   * null  — data is already unique, no action needed.
   * []    — at least one single candidate column is sufficient; the user should pick from candidates.
   * [...] — no single column is sufficient; greedy result of columns to add together.
   */
  suggestedAdditionalKeys: string[] | null;
}

export function analyzeJoinKeys(
  parsedData: Array<Record<string, any>>,
  keys: string[]
): JoinKeyAnalysis {
  if (parsedData.length === 0) {
    return { isUnique: true, duplicateCount: 0, duplicateValues: [], candidates: [], suggestedAdditionalKeys: null };
  }

  // 1. Composite key per row; count occurrences.
  const compositeKeys = parsedData.map(row =>
    keys.map(k => String(row[k] ?? '')).join('\0')
  );
  const keyCount = new Map<string, number>();
  for (const ck of compositeKeys) keyCount.set(ck, (keyCount.get(ck) ?? 0) + 1);

  const duplicateCount = [...keyCount.values()].reduce((n, c) => n + (c > 1 ? c - 1 : 0), 0);
  const isUnique = duplicateCount === 0;

  // Collect up to 5 distinct example duplicate key values.
  const duplicateValues: Array<Record<string, any>> = [];
  for (let i = 0; i < parsedData.length && duplicateValues.length < 5; i++) {
    if ((keyCount.get(compositeKeys[i]) ?? 0) > 1) {
      const vals = keys.reduce((acc, k) => { acc[k] = parsedData[i][k]; return acc; }, {} as Record<string, any>);
      if (!duplicateValues.some(v => JSON.stringify(v) === JSON.stringify(vals))) {
        duplicateValues.push(vals);
      }
    }
  }

  if (isUnique) {
    return { isUnique: true, duplicateCount: 0, duplicateValues: [], candidates: [], suggestedAdditionalKeys: null };
  }

  // 2. Candidate columns: all columns except current keys and system columns.
  const keySet = new Set(keys);
  const allColumns = new Set<string>();
  for (const row of parsedData) for (const col of Object.keys(row)) allColumns.add(col);

  const candidateColumns = [...allColumns].filter(
    col => !keySet.has(col) && !SYSTEM_COLUMNS.has(col)
  );

  // 3. Categorise: does (keys + col) achieve uniqueness?
  const candidates = candidateColumns.map(col => {
    const extended = parsedData.map(row =>
      [...keys, col].map(k => String(row[k] ?? '')).join('\0')
    );
    return { column: col, makesUnique: new Set(extended).size === parsedData.length };
  });

  // 4. suggestedAdditionalKeys
  if (candidates.some(c => c.makesUnique)) {
    // At least one single column is sufficient — return empty array as signal.
    return { isUnique, duplicateCount, duplicateValues, candidates, suggestedAdditionalKeys: [] };
  }

  // No single column is sufficient — greedy search for a minimal combination.
  const workingKeys = [...keys];
  const available = [...candidateColumns];

  while (available.length > 0) {
    const current = parsedData.map(row =>
      workingKeys.map(k => String(row[k] ?? '')).join('\0')
    );
    if (new Set(current).size === parsedData.length) break;

    let bestCol: string | null = null;
    let bestCount = new Set(current).size;

    for (const col of available) {
      const test = parsedData.map(row =>
        [...workingKeys, col].map(k => String(row[k] ?? '')).join('\0')
      );
      const count = new Set(test).size;
      if (count > bestCount) { bestCount = count; bestCol = col; }
    }

    if (bestCol === null) break; // no column improves uniqueness
    workingKeys.push(bestCol);
    available.splice(available.indexOf(bestCol), 1);
  }

  const added = workingKeys.slice(keys.length);
  const greedyIsUnique = new Set(
    parsedData.map(row => workingKeys.map(k => String(row[k] ?? '')).join('\0'))
  ).size === parsedData.length;
  return {
    isUnique,
    duplicateCount,
    duplicateValues,
    candidates,
    suggestedAdditionalKeys: (added.length > 0 && greedyIsUnique) ? added : null,
  };
}

/**
 * Full Psych-DS data filename pattern: one or more `keyword-value` pairs
 * (keyword: lowercase letters; value: alphanumeric, any case) joined by `_`,
 * ending in `_data.csv` (or `.tsv`).
 */
const PSYCH_DS_FILENAME_RE = /^([a-z]+-[a-zA-Z0-9]+)(_[a-z]+-[a-zA-Z0-9]+)*_data\.(csv|tsv)$/;

/** True if `name` is a fully Psych-DS-compliant data filename. */
export function isValidPsychDSDataFilename(name: string): boolean {
  return PSYCH_DS_FILENAME_RE.test(name);
}

/**
 * Coerces an arbitrary string into a Psych-DS *value* segment ([a-zA-Z0-9]+).
 * Runs of non-alphanumeric characters are treated as word boundaries: removed
 * and the next word capitalised, yielding camelCase so meaning is preserved
 * (e.g. "mouse_tracking" → "mouseTracking", "RT (ms)" → "RTMs").
 * Returns `fallback` when the input has no alphanumeric characters.
 */
export function toPsychDSValue(name: string, fallback = 'value'): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('');
}

/**
 * Derives the Psych-DS filename for an extracted-array CSV from its parent
 * file's already-normalized base plus the column name:
 *   base "subject-subject1" + column "mouse_tracking"
 *     → "subject-subject1_measure-mouseTracking_data.csv"
 */
export function deriveArrayFilename(parentBase: string, columnName: string): string {
  return `${parentBase}_measure-${toPsychDSValue(columnName, 'col')}_data.csv`;
}

/**
 * Serialises an array of objects to RFC 4180 CSV. Nested objects/arrays in a
 * cell are serialised as JSON strings so no data is lost. Priority columns
 * (trial_index, element_index by default) are placed first; remaining columns
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
 * Removes columns whose name is empty or whitespace-only from every row, in place,
 * and reports which names were dropped. R's `write.csv` (with the default
 * `row.names = TRUE`) prepends an unnamed row-index column, which surfaces as an
 * empty-string ("") header. Such a column can never be represented in a Psych-DS
 * `variableMeasured` entry (a name is required), so leaving it in produces a dataset
 * that fails validation with CSV_COLUMN_MISSING_FROM_METADATA. Dropping it up front —
 * once, rather than warning per row — keeps the generated metadata and the written
 * CSV consistent. Returns the same `rows` reference for convenient chaining.
 */
export function stripUnnamedColumns(
  rows: Array<Record<string, any>>
): { rows: Array<Record<string, any>>; dropped: string[] } {
  const unnamed = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key.trim() === "") unnamed.add(key);
    }
  }
  if (unnamed.size > 0) {
    for (const row of rows) {
      for (const key of unnamed) delete row[key];
    }
  }
  return { rows, dropped: [...unnamed] };
}

/**
 * Returns a filename not already present in `used`. If `base` is free it is
 * returned as-is; otherwise a counter is appended before the `_data.csv`
 * suffix (e.g. foo_measure-bar_data.csv → foo_measure-bar2_data.csv) until a
 * free name is found. The counter has no separator — a hyphen or underscore
 * would create an invalid Psych-DS keyword-value pair.
 *
 * KEEP IN SYNC: the CLI's resolveCollisions (packages/cli/src/rename.ts) applies
 * the same no-separator counter to its rename preview (this one writes, that one
 * previews — different input shapes keep them separate implementations). If the
 * counter convention ever changes, both must change together or previewed and
 * written names will diverge.
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

export async function parseCSV(input) {
  if (!parse) {
    throw new Error('Parser module not loaded');
  }
  // console.log("input:", input);
  return new Promise((resolve, reject) => {
    parse(input, {
      columns: true, // Treat the first row as headers
      delimiter: ',' // Specify the delimiter (e.g., comma)
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records);
      }
    });
  });
}
import { parse } from 'csv-parse';

// When raw jsPsych originals are preserved under data/raw/, the Psych-DS validator flags them
// as FILE_NOT_CHECKED. A .psychds-ignore file at the dataset root tells it to skip them. The
// pattern is `**/raw/` (not `data/raw/`) because the validator tests leading-slash paths, against
// which an anchored pattern won't match; the self-reference works around the validator only
// hard-excluding the legacy ".bidsignore". Shared so the CLI and frontend stay in sync.
export const PSYCHDS_IGNORE_FILENAME = '.psychds-ignore';
export const PSYCHDS_IGNORE_CONTENT = '**/raw/\n.psychds-ignore\n';

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

/**
 * Some jsPsych exports (e.g. from OSF) wrap the trials array as { "trials": [...] }
 * instead of a bare array. Accepts the raw JSON string (or an already-parsed value)
 * and returns the unwrapped trials array ONLY when the input is exactly that wrapper —
 * an object whose single key is `trials` and whose value is an array. Otherwise returns
 * the parsed value unchanged so the caller's existing Array.isArray gate keeps its
 * current behavior (the library throws on a non-array; the CLI/frontend skip non-array JSON).
 *
 * The single-key check is deliberate: this supports the known wrapper shape, it does not
 * treat `trials` as a magic key. A future export like { trials: [...], meta: {...} } is
 * left untouched rather than silently discarding its top-level metadata.
 *
 * Folded into parseJsonData's whole-document fast path so every data parse site (generate(),
 * the CLI pipeline, the frontend uploader) gets wrapper support through the one shared parser;
 * also exported for direct use and testing.
 */
export function unwrapTrials(data: string | unknown): unknown {
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    const keys = Object.keys(parsed);
    if (
      keys.length === 1 &&
      keys[0] === "trials" &&
      Array.isArray((parsed as Record<string, unknown>).trials)
    ) {
      return (parsed as Record<string, unknown>).trials;
    }
  }
  return parsed;
}

/**
 * Parses experiment data that is either a single JSON document (the standard jsPsych
 * export — one array of trials, possibly pretty-printed) or JSON-Lines: one JSON value
 * per line, as JATOS and several labs export it (typically one participant's trial
 * array per line). Returns a flat array of observations in both cases.
 *
 * A well-formed single document is returned as-is (arrays untouched, so existing
 * single-array callers see no change), except an exact { "trials": [...] } wrapper is
 * unwrapped to its array via {@link unwrapTrials}. Only when whole-string parsing fails do
 * we fall back to line-by-line parsing, flattening any per-line arrays into one observation
 * stream. Throws a descriptive error when the input is neither valid JSON nor valid JSONL.
 *
 * When `tagSourceRecordId` is set, `stats.synthesizedSourceRecordId` is set to true iff a
 * source_record_id was actually stamped onto at least one row (i.e. the data did not already
 * carry a source_record_id or a real participant_id). Callers use this to describe the column
 * honestly — a synthesized id marks the source record/line, not a real subject identifier, and
 * must not be presented as one.
 */
export function parseJsonData(
  content: string,
  options: { tagSourceRecordId?: boolean } = {},
  stats?: { synthesizedSourceRecordId?: boolean }
): any {
  // Fast path: a single, well-formed JSON document. Covers the standard single array
  // (including pretty-printed/multi-line) with no behaviour change for existing callers.
  // unwrapTrials accepts an exact { "trials": [...] } wrapper (e.g. OSF exports) and returns
  // every other shape untouched, so a bare array passes through unchanged.
  // Note: tagSourceRecordId never applies here — a single document has no line boundaries
  // to identify source records by, so its rows are returned untouched.
  const whole = tryParseJSON(content);
  if (whole !== null) return unwrapTrials(whole);

  // Fallback: JSON-Lines. Each non-empty line must be its own JSON value; per-line
  // arrays are concatenated so a multi-participant export becomes one observation array.
  const lines = content.split(/\r?\n/);
  const out: any[] = [];
  let parsedAny = false;
  let recordIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error(
        `Could not parse data as JSON or JSON-Lines: line ${i + 1} is not valid JSON.`
      );
    }
    parsedAny = true;
    const observations = Array.isArray(value) ? value : [value];
    // In JSON-Lines each line is typically one participant's submission (JATOS-style export),
    // but a line is only guaranteed to be one *source record* — the per-line boundary is the
    // only identifier these raw jsPsych exports carry. So — when asked — stamp every object
    // observation from this line with a 0-based source_record_id before that boundary is lost
    // in the flattened stream. This lets nested array/object extraction form a unique
    // (source_record_id, trial_index) join key. Rows that already carry a source_record_id or a
    // real participant_id are left untouched (the experiment's own id already groups them);
    // non-object lines (bare primitives) can't carry the tag.
    if (options.tagSourceRecordId) {
      for (const obs of observations) {
        if (obs !== null && typeof obs === "object" && !Array.isArray(obs) &&
            !("source_record_id" in obs) && !("participant_id" in obs)) {
          obs.source_record_id = recordIndex;
          if (stats) stats.synthesizedSourceRecordId = true;
        }
      }
    }
    out.push(...observations);
    recordIndex++;
  }

  if (!parsedAny) {
    throw new Error("Could not parse data: input is empty or not valid JSON/JSON-Lines.");
  }
  return out;
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

  // Exclude unnamed/whitespace-only-header columns (e.g. R write.csv's row-index column):
  // stripUnnamedColumns (#114) drops them from the written output, so proposing one as a join
  // key — interactively or in the headless resolver — would pick a column that can't survive to
  // the sidecar, and emit a confusing `added ""` message (#117). Reuse isUnnamedHeader so this
  // can never diverge from the drop.
  const candidateColumns = [...allColumns].filter(
    col => !isUnnamedHeader(col) && !keySet.has(col) && !SYSTEM_COLUMNS.has(col)
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
 * Builds a Psych-DS-compliant filename *base* (the keyword-value sequence before
 * `_data.csv`) from an arbitrary file stem, with no interactive input. Used by
 * callers that lack a user-supplied/normalized base (e.g. the browser flow): the
 * stem becomes the value of the official `subject` keyword, coerced to a valid
 * value segment via {@link toPsychDSValue} (e.g. "sub01" → "subject-sub01",
 * "subject 1.json".replace stem "subject 1" → "subject-subject1"). `subject` is an
 * official Psych-DS keyword, so the resulting main datafile avoids the validator's
 * unofficial-keyword warning. The result always satisfies
 * {@link isValidPsychDSDataFilename} once `_data.csv` is appended.
 */
export function deriveFallbackBase(stem: string): string {
  return `subject-${toPsychDSValue(stem, 'file')}`;
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

/** A column header is "unnamed" when it is empty or whitespace-only — the unnamed row-index
 *  column R's `write.csv` prepends. The single source of truth for that rule; both
 *  {@link stripUnnamedColumns} and {@link hasUnnamedColumns} use it so they can never diverge. */
const isUnnamedHeader = (key: string): boolean => key.trim() === "";

/**
 * True when any row carries an {@link isUnnamedHeader unnamed} column. Lets a caller decide,
 * *before* `generate()` mutates the rows in place, whether a CSV source can be written back
 * byte-for-byte (no unnamed columns) or must be re-serialised from the cleaned rows. Kept as a
 * shared predicate so the CLI and browser conversion paths share one definition of "unnamed"
 * with {@link stripUnnamedColumns}, rather than each re-implementing the header scan.
 */
export function hasUnnamedColumns(rows: Array<Record<string, any>>): boolean {
  return rows.some((row) => Object.keys(row).some(isUnnamedHeader));
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
      if (isUnnamedHeader(key)) unnamed.add(key);
    }
  }
  if (unnamed.size > 0) {
    for (const row of rows) {
      for (const key of unnamed) delete row[key];
    }
  }
  return { rows, dropped: [...unnamed] };
}

/** A single converted Psych-DS output file produced by {@link buildPsychDSDataFiles}. */
export interface PsychDSDataFile {
  /** Psych-DS-compliant filename, relative to the `data/` directory. */
  filename: string;
  /** RFC-4180 CSV contents. */
  content: string;
  /** Which source the rows came from: the main table, an array column, or an object column. */
  kind: 'main' | 'array' | 'object';
}

export interface BuildPsychDSDataFilesArgs {
  /** Compliant filename base (keyword-value sequence before `_data.csv`), e.g. "id-sub01". */
  base: string;
  /**
   * Parsed rows of the main data file. Serialised to CSV unless `mainContent` is given and
   * no unnamed columns are dropped. Always supply this (parse CSV inputs too) so unnamed
   * row-index columns can be detected and stripped.
   */
  mainRows: Array<Record<string, any>>;
  /**
   * Pre-rendered CSV for the main file, used verbatim instead of serialising `mainRows` —
   * but only when no unnamed columns are dropped. Pass this when the source is already CSV
   * so a clean file keeps its exact bytes (column order, quoting); a file with an unnamed
   * column is re-serialised from the cleaned `mainRows` instead.
   */
  mainContent?: string;
  /** Array-column rows keyed by column name (from `JsPsychMetadata.getExtractedArrays`). */
  extractedArrays?: Map<string, Array<Record<string, any>>>;
  /** Object-column rows keyed by column name (from `JsPsychMetadata.getExtractedObjects`). */
  extractedObjects?: Map<string, Array<Record<string, any>>>;
  /** Join keys used when extracting nested columns (from `JsPsychMetadata.getArrayJoinKeys`). */
  joinKeys?: string[];
  /**
   * Set of already-used output filenames, shared across all files in a dataset so names are
   * disambiguated against the whole `data/` directory. Mutated: every name returned is added.
   */
  usedArrayFilenames?: Set<string>;
}

/**
 * Turns one parsed data file (plus any nested array/object columns extracted during
 * `JsPsychMetadata.generate`) into its set of Psych-DS CSV outputs. Pure and
 * filesystem-agnostic: the caller decides where the returned contents go (the CLI writes
 * them to disk, the browser puts them in a file tree / zip). Mirrors the conversion the CLI
 * performs inline so both share one implementation.
 *
 * The main table becomes `${base}_data.csv`; each extracted array/object column becomes a
 * sidecar named via {@link deriveArrayFilename}, disambiguated against `usedArrayFilenames`.
 * Throws if a resolved name isn't Psych-DS-compliant (an invalid `base` reaching here is a
 * programming error — callers derive `base` with {@link deriveFallbackBase} or a validated plan).
 */
export function buildPsychDSDataFiles(args: BuildPsychDSDataFilesArgs): PsychDSDataFile[] {
  const {
    base,
    mainRows,
    mainContent,
    extractedArrays = new Map(),
    extractedObjects = new Map(),
    joinKeys = ['trial_index'],
    usedArrayFilenames = new Set<string>(),
  } = args;

  const out: PsychDSDataFile[] = [];

  const reserve = (name: string): string => {
    if (!isValidPsychDSDataFilename(name)) {
      throw new Error(`Refusing to write non-Psych-DS-compliant data filename "${name}".`);
    }
    usedArrayFilenames.add(name);
    return name;
  };

  // Main table. Disambiguate up front so a later file sharing this base doesn't overwrite it.
  const mainName = reserve(disambiguateArrayFilename(`${base}_data.csv`, usedArrayFilenames));
  // Drop unnamed columns (R's row-index artifact) so the written CSV matches variableMeasured,
  // which generate() also strips. A clean CSV input keeps its exact bytes (mainContent verbatim);
  // a dirty one is re-serialised from the cleaned rows, as is JSON (no mainContent given).
  const { rows: cleanedMainRows, dropped: droppedMain } = stripUnnamedColumns(mainRows);
  out.push({
    filename: mainName,
    content: (mainContent !== undefined && droppedMain.length === 0)
      ? mainContent
      : objectsToCSV(cleanedMainRows, ['trial_index']),
    kind: 'main',
  });

  // Sidecars: arrays carry element_index alongside the join keys; objects are one row per trial.
  const arrayPriority = [...joinKeys, 'element_index'];
  for (const [colName, rows] of extractedArrays) {
    const name = reserve(disambiguateArrayFilename(deriveArrayFilename(base, colName), usedArrayFilenames));
    out.push({ filename: name, content: objectsToCSV(rows, arrayPriority), kind: 'array' });
  }
  for (const [colName, rows] of extractedObjects) {
    const name = reserve(disambiguateArrayFilename(deriveArrayFilename(base, colName), usedArrayFilenames));
    out.push({ filename: name, content: objectsToCSV(rows, joinKeys), kind: 'object' });
  }

  return out;
}

export async function parseCSV(input) {
  if (!parse) {
    throw new Error('Parser module not loaded');
  }
  // console.log("input:", input);
  return new Promise((resolve, reject) => {
    parse(input, {
      columns: true, // Treat the first row as headers
      delimiter: ',', // Specify the delimiter (e.g., comma)
      bom: true // Strip a leading UTF-8 BOM so the first header name isn't corrupted (e.g. "﻿Participant_ID")
    }, (err, records) => {
      if (err) {
        reject(err);
      } else {
        resolve(records);
      }
    });
  });
}
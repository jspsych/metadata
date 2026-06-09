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
/**
 * Smart rename strategies for data files whose names don't follow the Psych-DS
 * pattern ([keyword-value_]+data.csv). Everything here is pure (no prompting,
 * no filesystem) so it can be unit-tested; the interactive flow lives in
 * index.ts (resolveFilenameNormalization).
 */

/**
 * Official Psych-DS filename keywords (psychds-validator schema). Any other
 * keyword in a filename is legal but triggers FILENAME_UNOFFICIAL_KEYWORD_WARNING.
 */
export const OFFICIAL_KEYWORDS = new Set([
  'study', 'site', 'subject', 'session', 'task', 'condition', 'trial', 'stimulus', 'description',
]);

/**
 * Lists the unofficial keywords in an otherwise-compliant Psych-DS base:
 * "data-pmlfboigs" → ["data"], "subject-01_session-2" → []. Used to offer the
 * rename flow for files that are technically valid but would emit warnings.
 */
export function unofficialKeywords(base: string): string[] {
  return base
    .split('_')
    .map((pair) => pair.split('-')[0])
    .filter((kw) => !OFFICIAL_KEYWORDS.has(kw));
}

/**
 * Finds the longest common prefix and suffix shared by all stems and returns
 * them along with each stem's varying middle part. Returns null unless there
 * are at least two stems and the middles are all non-empty and pairwise
 * distinct (otherwise the "pattern" would collapse files onto the same name or
 * an empty value). The prefix is matched greedily; the suffix only consumes
 * what the shortest remaining middle allows, so the two never overlap.
 */
export function extractVaryingMiddles(
  stems: string[]
): { prefix: string; suffix: string; middles: Map<string, string> } | null {
  if (stems.length < 2) return null;

  let prefixLen = 0;
  const first = stems[0];
  while (prefixLen < first.length && stems.every((s) => s[prefixLen] === first[prefixLen])) {
    prefixLen += 1;
  }

  const shortestRemainder = Math.min(...stems.map((s) => s.length - prefixLen));
  let suffixLen = 0;
  while (
    suffixLen < shortestRemainder &&
    stems.every((s) => s[s.length - 1 - suffixLen] === first[first.length - 1 - suffixLen])
  ) {
    suffixLen += 1;
  }

  const middles = new Map<string, string>();
  const used = new Set<string>();
  for (const stem of stems) {
    const middle = stem.slice(prefixLen, stem.length - suffixLen);
    if (middle.length === 0 || used.has(middle)) return null;
    used.add(middle);
    middles.set(stem, middle);
  }
  return {
    prefix: first.slice(0, prefixLen),
    suffix: suffixLen > 0 ? first.slice(first.length - suffixLen) : '',
    middles,
  };
}

/**
 * Identifier columns recognised by the "read ID from the data" strategy, in
 * priority order. All map to the `subject` keyword.
 */
export const ID_COLUMNS = ['subject_id', 'participant_id', 'subject', 'participant', 'PROLIFIC_PID', 'prolific_pid'];

/**
 * Searches parsed file contents for an identifier column usable as a filename
 * value. A column qualifies only if every file has it with exactly one unique
 * non-empty value (a file mixing several subject IDs can't be named after one
 * of them). Returns the first qualifying column from ID_COLUMNS plus each
 * file's value, or null when none qualifies.
 */
export function findIdentifierColumn(
  rowsByFile: Map<string, Array<Record<string, any>>>
): { column: string; values: Map<string, string> } | null {
  if (rowsByFile.size === 0) return null;

  for (const column of ID_COLUMNS) {
    const values = new Map<string, string>();
    let ok = true;
    for (const [filePath, rows] of rowsByFile) {
      const unique = new Set<string>();
      for (const row of rows) {
        const v = row[column];
        if (v !== undefined && v !== null && String(v).trim() !== '') unique.add(String(v).trim());
      }
      if (unique.size !== 1) {
        ok = false;
        break;
      }
      values.set(filePath, unique.values().next().value as string);
    }
    if (ok) return { column, values };
  }
  return null;
}

/**
 * Generates `count` sequential bases following a user-supplied example for the
 * first file: "subject-001" → ["subject-001", "subject-002", …]. The trailing
 * digits are incremented and their zero-padding preserved (rolling past the
 * width simply grows the number: "subject-99" → "subject-100"). Returns null
 * when the example doesn't end in digits, so there is no number to continue.
 */
export function sequentialBases(example: string, count: number): string[] | null {
  const m = /^(.*?)(\d+)$/.exec(example);
  if (!m) return null;
  const [, prefix, digits] = m;
  const start = parseInt(digits, 10);
  const width = digits.length;
  return Array.from({ length: count }, (_, i) => `${prefix}${String(start + i).padStart(width, '0')}`);
}

/**
 * Resolves duplicate proposed bases. The first file keeps the base; later
 * duplicates get a counter appended directly to the final value (subject-1 →
 * subject-12, subject-13, …), following disambiguateArrayFilename's convention:
 * no separator, because a hyphen or underscore would break the keyword-value
 * grammar. Returns the final bases plus the set of paths whose base was
 * adjusted, so the preview table can flag them.
 */
export function resolveCollisions(
  proposals: Map<string, string>
): { bases: Map<string, string>; adjusted: Set<string> } {
  const bases = new Map<string, string>();
  const adjusted = new Set<string>();
  const used = new Set<string>();

  for (const [filePath, base] of proposals) {
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${base}${n}`;
      n += 1;
    }
    if (candidate !== base) adjusted.add(filePath);
    used.add(candidate);
    bases.set(filePath, candidate);
  }
  return { bases, adjusted };
}

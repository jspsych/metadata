// Normalizes uploaded data file content before it is fed to generate(), zipped, and
// validated, so all three see the same bytes. Mirrors the CLI's data-file writer: an
// R-style CSV export (write.csv with the default row.names=TRUE) prepends an unnamed
// row-index column whose empty header can't be represented in variableMeasured, so the
// library drops it from the metadata. If we left it in the CSV the dataset would fail
// in-browser validation with CSV_COLUMN_MISSING_FROM_METADATA and the downloaded zip
// would ship an invalid file.

import { parseCSV, objectsToCSV, stripUnnamedColumns } from '@jspsych/metadata';

export interface NormalizedContent {
  content: string;
  dropped: string[];
}

/**
 * Drops unnamed (empty/whitespace-only header) columns from CSV content, returning a
 * re-serialised CSV that matches what generate() puts in variableMeasured. Column order
 * is preserved. When there is nothing to drop — or the input isn't CSV, or can't be
 * parsed — the original content is returned byte-for-byte so well-formed files are never
 * reformatted. JSON is passed through unchanged (jsPsych JSON has named keys, and the
 * frontend zips JSON as-is rather than converting it).
 */
export async function normalizeDataContent(
  content: string,
  type: string
): Promise<NormalizedContent> {
  if (type !== 'csv') return { content, dropped: [] };

  try {
    const rows = (await parseCSV(content)) as Array<Record<string, unknown>>;
    const { rows: cleaned, dropped } = stripUnnamedColumns(rows);
    if (dropped.length === 0) return { content, dropped: [] };
    return { content: objectsToCSV(cleaned, []), dropped };
  } catch {
    // Unparseable CSV: leave it untouched and let generate()/validation surface the error.
    return { content, dropped: [] };
  }
}

// Shared knowledge about how a Psych-DS dataset is laid out, used by both the
// Review download (zip) and the in-browser validator so the two never drift.

/** Canonical Psych-DS metadata filename. */
export const DATASET_DESCRIPTION_FILENAME = 'dataset_description.json';

/**
 * Maps an uploaded file's original path to its place in the dataset layout:
 * strips the top-level export folder and nests it under `data/`
 * (e.g. "my-experiment/sub01.csv" -> "data/sub01.csv").
 */
export function dataFilePath(originalPath: string): string {
  const parts = originalPath.split('/');
  const relative = parts.length > 1 ? parts.slice(1).join('/') : originalPath;
  return `data/${relative}`;
}

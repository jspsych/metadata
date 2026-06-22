// Builds the downloadable Psych-DS dataset zip from the staged file store.
//
// Reads each data file from the store lazily (one at a time) and adds it to the archive, so the
// whole converted payload is never held in the JS heap at once — only the file currently being
// compressed. JSZip's input files are read during generateAsync(); pairing it with the OPFS-backed
// store (disk-backed Blobs) keeps the input side off the heap. If profiling later shows the output
// Blob itself is the bottleneck, this is the seam to swap JSZip for a streaming zip (e.g.
// client-zip) writing to a disk-backed sink — callers only depend on buildDatasetZipBlob.

import JSZip from 'jszip';
import { DATASET_DESCRIPTION_FILENAME } from '../datasetLayout';
import type { DatasetFileSource } from './stagedFileStore';

const readmeContents = (projectName: string): string =>
  `# ${projectName}\nHuman-readable description of the project and dataset.`;

const CHANGES_CONTENTS =
  'For version tracking — if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.';

export interface BuildDatasetZipOptions {
  /** Serialized dataset_description.json (written at the archive root). */
  metadataJson: string;
  /** Used for the README heading; not the zip filename. */
  projectName: string;
  /** Staged `data/` payload (paths already include the `data/` prefix). Omit for metadata-only. */
  dataFiles?: DatasetFileSource;
}

/**
 * Assembles dataset_description.json + the staged data files + README/CHANGES into a single zip
 * Blob, ready to hand to a download. Data files are pulled from the source one at a time.
 */
export async function buildDatasetZipBlob({
  metadataJson,
  projectName,
  dataFiles,
}: BuildDatasetZipOptions): Promise<Blob> {
  const zip = new JSZip();
  zip.file(DATASET_DESCRIPTION_FILENAME, metadataJson);
  if (dataFiles) {
    for await (const [path, blob] of dataFiles.entries()) {
      zip.file(path, blob); // path already includes the `data/` prefix
    }
  }
  zip.file('README.md', readmeContents(projectName));
  zip.file('CHANGES.md', CHANGES_CONTENTS);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

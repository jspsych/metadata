// Builds and streams the downloadable Psych-DS dataset zip from the staged file store.
//
// Uses fflate's AsyncZipDeflate (DEFLATE compressed, worker-backed when available) to emit
// output chunks as each file finishes compressing — so neither the full input set nor the
// complete output zip ever lives in the JS heap at once. On Chromium (showSaveFilePicker) each
// chunk is written to the user-chosen file as it arrives, bounding peak heap to roughly one
// file's working set. On other browsers (or if the picker fails) chunks are collected into a
// Blob and downloaded via an object URL.

import { Zip, AsyncZipDeflate } from 'fflate';
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

/** Minimal write-close-abort sink; satisfied by FileSystemWritableFileStream. */
interface ZipSink {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

/**
 * Runs the zip build and routes each output chunk to `onChunk`. Resolves once the zip is
 * complete (all chunks delivered). Each data file is read from the store one at a time.
 */
async function buildZip(opts: BuildDatasetZipOptions, onChunk: (dat: Uint8Array) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const zip = new Zip((err, dat, final) => {
      if (err) { reject(err); return; }
      onChunk(dat);
      if (final) resolve();
    });

    const addEntry = (filename: string, content: Uint8Array): void => {
      const entry = new AsyncZipDeflate(filename, { level: 6 });
      zip.add(entry);
      entry.push(content, true);
    };

    (async () => {
      try {
        addEntry(DATASET_DESCRIPTION_FILENAME, new TextEncoder().encode(opts.metadataJson));
        if (opts.dataFiles) {
          for await (const [path, blob] of opts.dataFiles.entries()) {
            addEntry(path, new Uint8Array(await blob.arrayBuffer()));
          }
        }
        addEntry('README.md', new TextEncoder().encode(readmeContents(opts.projectName)));
        addEntry('CHANGES.md', new TextEncoder().encode(CHANGES_CONTENTS));
        zip.end();
      } catch (e) {
        reject(e);
      }
    })();
  });
}

async function streamZipToSink(opts: BuildDatasetZipOptions, sink: ZipSink): Promise<void> {
  // write() calls are fired as chunks arrive so fflate's worker keeps compressing while the OS
  // writes earlier chunks. FileSystemWritableFileStream serialises them internally. Promise.all
  // detects any write failure after the last chunk is delivered. Per-chunk backpressure would
  // require pausing the worker between chunks, which fflate's callback API doesn't support.
  const writes: Promise<void>[] = [];
  try {
    await buildZip(opts, (dat) => writes.push(sink.write(dat)));
    await Promise.all(writes);
    await sink.close();
  } catch (e) {
    await sink.abort().catch(() => {});
    throw e;
  }
}

function blobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Assembles the dataset zip and returns it as a Blob. Each data file is read from the store
 * one at a time; output chunks are collected into a single Blob. Use {@link downloadDatasetZip}
 * to trigger a browser download with a streaming disk sink when available.
 */
export async function buildDatasetZipBlob(opts: BuildDatasetZipOptions): Promise<Blob> {
  const chunks: Uint8Array[] = [];
  await buildZip(opts, (dat) => chunks.push(dat));
  return new Blob(chunks, { type: 'application/zip' });
}

/**
 * Builds the dataset zip and triggers a browser download. On Chromium (`showSaveFilePicker`)
 * each zip chunk is written to a user-chosen file as it arrives — peak heap stays at roughly
 * one file's working set. On other browsers it falls back to collecting into a Blob and
 * downloading via an object URL (same peak as before; input files are still one at a time).
 *
 * Returns `true` when a download was triggered, `false` when the user aborted the save dialog.
 * Streaming errors (e.g. disk full) are propagated as exceptions — callers should surface them.
 */
export async function downloadDatasetZip(
  opts: BuildDatasetZipOptions,
  filename: string,
): Promise<boolean> {
  if ('showSaveFilePicker' in window) {
    // Separate picker/handle creation (catches AbortError + setup errors → blob fallback) from
    // the streaming step (propagates errors so callers can show them instead of silently
    // falling back to blob, which would also fail if the disk is full).
    let sink: ZipSink | undefined;
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP file', accept: { 'application/zip': ['.zip'] } }],
      });
      sink = await fileHandle.createWritable() as ZipSink;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return false;
      // Picker or handle creation failed — fall through to blob download.
    }
    if (sink) {
      await streamZipToSink(opts, sink); // errors propagate to caller
      return true;
    }
  }
  const chunks: Uint8Array[] = [];
  await buildZip(opts, (dat) => chunks.push(dat));
  blobDownload(new Blob(chunks, { type: 'application/zip' }), filename);
  return true;
}

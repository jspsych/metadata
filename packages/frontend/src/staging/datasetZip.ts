// Builds and streams the downloadable Psych-DS dataset zip from the staged file store.
//
// Files are compressed strictly one at a time. For each entry we create a single fflate
// AsyncZipDeflate, feed the file's bytes in bounded ~1 MiB slices (read lazily from the
// disk-backed Blob), and wait for that entry's final compressed chunk before starting the next
// one. fflate spawns one worker per live AsyncZipDeflate and buffers later entries until earlier
// ones finish, so processing sequentially keeps exactly one worker (and roughly one file's
// working set) resident at a time rather than N workers plus most of the compressed dataset in
// the heap. Output chunks are emitted as they are produced: on Chromium (showSaveFilePicker) each
// is written to the user-chosen file as it arrives, bounding peak heap to about one file's
// working set; on other browsers (or if the picker fails) chunks are collected into a Blob and
// downloaded via an object URL.

import { Zip, AsyncZipDeflate } from 'fflate';
import { DATASET_DESCRIPTION_FILENAME, datasetDocs } from '../datasetLayout';
import { blobDownload } from '../download';
import type { DatasetFileSource } from './stagedFileStore';

/** Slice size for feeding a file into the deflater — bounds peak heap to ~one slice per file. */
const PUSH_CHUNK_BYTES = 1 << 20; // 1 MiB

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
 * complete (all chunks delivered). Entries are compressed strictly one at a time: each file is
 * read from the store lazily, pushed into its own deflater in ~1 MiB slices, and awaited to its
 * final compressed chunk before the next entry's deflater is created.
 */
async function buildZip(opts: BuildDatasetZipOptions, onChunk: (dat: Uint8Array) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    let failed = false;
    const fail = (err: unknown) => { if (!failed) { failed = true; reject(err); } };

    const zip = new Zip((err, dat, final) => {
      if (err) { fail(err); return; }
      onChunk(dat);
      if (final) resolve();
    });

    // Add one entry, feed it in bounded slices, and resolve only once its final compressed chunk
    // has been emitted — so no second AsyncZipDeflate (hence no second worker) is created until
    // this one is done.
    const addEntrySequential = (filename: string, content: Blob): Promise<void> => {
      const entry = new AsyncZipDeflate(filename, { level: 6 });
      zip.add(entry);
      // zip.add installs the routing handler that streams this entry's bytes into the archive;
      // wrap it so we also learn when this entry has emitted its final chunk.
      const routeToZip = entry.ondata!;
      return new Promise<void>((resolveEntry, rejectEntry) => {
        entry.ondata = (err, dat, final) => {
          routeToZip(err, dat, final);
          if (err) rejectEntry(err);
          else if (final) resolveEntry();
        };
        void (async () => {
          try {
            const size = content.size;
            if (size === 0) { entry.push(new Uint8Array(0), true); return; }
            for (let off = 0; off < size; off += PUSH_CHUNK_BYTES) {
              const end = Math.min(off + PUSH_CHUNK_BYTES, size);
              const slice = new Uint8Array(await content.slice(off, end).arrayBuffer());
              entry.push(slice, end >= size);
            }
          } catch (e) {
            rejectEntry(e);
          }
        })();
      });
    };

    (async () => {
      try {
        await addEntrySequential(
          DATASET_DESCRIPTION_FILENAME,
          new Blob([new TextEncoder().encode(opts.metadataJson)]),
        );
        if (opts.dataFiles) {
          for await (const [path, blob] of opts.dataFiles.entries()) {
            await addEntrySequential(path, blob);
          }
        }
        for (const { path, contents } of datasetDocs(opts.projectName)) {
          await addEntrySequential(path, new Blob([contents]));
        }
        zip.end();
      } catch (e) {
        fail(e);
      }
    })();
  });
}

async function streamZipToSink(opts: BuildDatasetZipOptions, sink: ZipSink): Promise<void> {
  // write() calls are fired as chunks arrive so fflate's worker keeps compressing while the OS
  // writes earlier chunks. FileSystemWritableFileStream serialises them internally. Promise.all
  // detects any write failure after the last chunk is delivered. Per-chunk backpressure would
  // require pausing the worker between chunks, which fflate's callback API doesn't support.
  //
  // .catch(() => {}) is attached to each write promise at creation so that late chunk callbacks
  // (from fflate workers already in-flight when buildZip rejects) don't produce unhandled
  // rejections when they call sink.write() on the now-aborted stream. Promise.all still sees
  // the original rejections through the writes[] references.
  const writes: Promise<void>[] = [];
  try {
    await buildZip(opts, (dat) => {
      const w = sink.write(dat);
      w.catch(() => {});
      writes.push(w);
    });
    await Promise.all(writes);
    await sink.close();
  } catch (e) {
    await sink.abort().catch(() => {});
    throw e;
  }
}

/**
 * Assembles the dataset zip and returns it as a Blob. Each data file is read from the store
 * one at a time; output chunks are collected into a single Blob. Use {@link downloadDatasetZip}
 * to trigger a browser download with a streaming disk sink when available.
 */
export async function buildDatasetZipBlob(opts: BuildDatasetZipOptions): Promise<Blob> {
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  await buildZip(opts, (dat) => chunks.push(dat as Uint8Array<ArrayBuffer>));
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
      const fileHandle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<{ createWritable: () => Promise<ZipSink> }>;
        }
      ).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'ZIP file', accept: { 'application/zip': ['.zip'] } }],
      });
      sink = await fileHandle.createWritable();
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return false;
      // Picker or handle creation failed — fall through to blob download.
    }
    if (sink) {
      await streamZipToSink(opts, sink); // errors propagate to caller
      return true;
    }
  }
  blobDownload(await buildDatasetZipBlob(opts), filename);
  return true;
}

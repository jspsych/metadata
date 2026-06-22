// Staging store for the converted Psych-DS payload.
//
// Why this exists: the upload → validate → download pipeline used to hold every converted CSV
// (and every preserved raw original) in the JS heap at once as strings, then hand all of it to
// the validator (as Blobs) and to JSZip simultaneously. For a large multi-file study that is
// several full copies of the whole dataset resident at the same time, which OOMs the tab.
//
// This store keeps each file's bytes on disk via the Origin Private File System (OPFS) instead
// of the heap. Callers write each file as it's produced and later read them back one at a time
// (for validation and for the zip), so peak heap is ~one file's working set rather than the
// whole study. OPFS is available in current Chromium, Firefox and Safari and needs no
// save-dialog permission. When OPFS is unavailable (older browsers, non-secure contexts, the
// jsdom test env) it transparently falls back to an in-memory Map — same API, no disk benefit.
//
// The on-disk layout is flat: dataset-relative paths (e.g. "data/raw/sub01.json") are encoded
// into single OPFS filenames, and the real paths are kept in a small in-memory index (just
// strings — kilobytes even for thousands of files). entries() reads files lazily so nothing is
// materialized until the consumer pulls it.

export type StagedFileStoreBackend = 'opfs' | 'memory';

export interface StagedFileStore {
  /** Backend actually in use, for diagnostics/measurement. */
  readonly backend: StagedFileStoreBackend;
  /** Stage one file. `content` may be a string or a Blob; large content should be a Blob. */
  write(path: string, content: string | Blob): Promise<void>;
  /** Whether a path has been staged. */
  has(path: string): boolean;
  /** All staged dataset-relative paths, in insertion order. */
  paths(): string[];
  /** Read one staged file back as a (disk-backed, on OPFS) Blob. */
  read(path: string): Promise<Blob>;
  /** Lazily iterate every staged file as [path, Blob], reading one at a time. */
  entries(): AsyncIterableIterator<[string, Blob]>;
  /** Remove every staged file and reset the index. */
  clear(): Promise<void>;
}

/** Name of the OPFS subdirectory the store scopes its files to. */
const STAGING_DIR = 'psychds-staging';

/** True when the Origin Private File System is usable in this environment. */
export function opfsAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.storage &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

// A path can't be an OPFS filename verbatim ("/" is the only forbidden character in practice),
// so encode it reversibly. encodeURIComponent also escapes characters some filesystems dislike.
const encodePath = (path: string): string => encodeURIComponent(path);

class OpfsFileStore implements StagedFileStore {
  readonly backend = 'opfs' as const;
  // Real dataset-relative paths in insertion order; the on-disk name is encodePath(path).
  private readonly index: string[] = [];

  private async dir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(STAGING_DIR, { create: true });
  }

  async write(path: string, content: string | Blob): Promise<void> {
    const dir = await this.dir();
    const handle = await dir.getFileHandle(encodePath(path), { create: true });
    const writable = await handle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
    if (!this.index.includes(path)) this.index.push(path);
  }

  has(path: string): boolean {
    return this.index.includes(path);
  }

  paths(): string[] {
    return [...this.index];
  }

  async read(path: string): Promise<Blob> {
    const dir = await this.dir();
    const handle = await dir.getFileHandle(encodePath(path));
    return handle.getFile(); // a File is a disk-backed Blob — not pulled into the heap until read
  }

  async *entries(): AsyncIterableIterator<[string, Blob]> {
    for (const path of this.index) {
      yield [path, await this.read(path)];
    }
  }

  async clear(): Promise<void> {
    const root = await navigator.storage.getDirectory();
    // removeEntry recurses with { recursive: true }; ignore "not found" so clear() is idempotent.
    try {
      await root.removeEntry(STAGING_DIR, { recursive: true });
    } catch {
      /* directory may not exist yet — nothing to clear */
    }
    this.index.length = 0;
  }
}

class MemoryFileStore implements StagedFileStore {
  readonly backend = 'memory' as const;
  private readonly files = new Map<string, Blob>();

  async write(path: string, content: string | Blob): Promise<void> {
    this.files.set(path, content instanceof Blob ? content : new Blob([content]));
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  paths(): string[] {
    return [...this.files.keys()];
  }

  async read(path: string): Promise<Blob> {
    const blob = this.files.get(path);
    if (!blob) throw new Error(`No staged file at "${path}".`);
    return blob;
  }

  async *entries(): AsyncIterableIterator<[string, Blob]> {
    for (const [path, blob] of this.files) {
      yield [path, blob];
    }
  }

  async clear(): Promise<void> {
    this.files.clear();
  }
}

/**
 * Creates a staging store, preferring OPFS (on-disk, bounded heap) and falling back to an
 * in-memory store when OPFS isn't available. Pass `forceMemory` to opt out of OPFS (e.g. tests).
 */
export function createStagedFileStore(opts: { forceMemory?: boolean } = {}): StagedFileStore {
  return !opts.forceMemory && opfsAvailable() ? new OpfsFileStore() : new MemoryFileStore();
}

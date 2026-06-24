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
// Each store instance owns a per-session subdirectory of STAGING_ROOT (a timestamped, random
// name), so two tabs of the same origin never read or clear each other's staged files. Within
// that subdir the layout is flat: dataset-relative paths (e.g. "data/raw/sub01.json") are encoded
// into single OPFS filenames, and the real paths are kept in a small in-memory index (just
// strings — kilobytes even for thousands of files). entries() reads files lazily so nothing is
// materialized until the consumer pulls it. Subdirectories left behind by sessions that closed
// without clearing are reclaimed by sweepStaleStagingDirs(), called once at app startup.

export type StagedFileStoreBackend = 'opfs' | 'memory';

/**
 * A lazy source of dataset-relative files (path -> Blob), read one at a time. Both the validator
 * (tree building) and the zip builder consume this, so neither needs the whole payload in the
 * heap at once. {@link StagedFileStore} is the production implementation.
 */
export interface DatasetFileSource {
  entries(): AsyncIterableIterator<[string, Blob]>;
}

export interface StagedFileStore extends DatasetFileSource {
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

/** Name of the OPFS directory that all staging sessions live under. */
const STAGING_ROOT = 'psychds-staging';

/**
 * Per-session subdirs older than this are reclaimed by {@link sweepStaleStagingDirs}. Long enough
 * that a session left open for a normal working span is never swept out from under itself; short
 * enough that disk from a crashed or closed tab is reclaimed on a later visit.
 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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

// Per-session subdir name: a base36 timestamp prefix (so its age is recoverable for the stale
// sweep) followed by random entropy (so two tabs created in the same millisecond never collide).
function newSessionDirName(): string {
  const ts = Date.now().toString(36);
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 0x1_0000_0000).toString(36);
  return `${ts}-${rand}`;
}

// Age in ms of a session subdir from its name, or null if the name isn't one we minted.
function sessionDirAgeMs(name: string, now: number): number | null {
  const ts = parseInt(name.split('-')[0] ?? '', 36);
  return Number.isFinite(ts) && ts > 0 ? now - ts : null;
}

class OpfsFileStore implements StagedFileStore {
  readonly backend = 'opfs' as const;
  // Real dataset-relative paths in insertion order; the on-disk name is encodePath(path).
  private readonly index: string[] = [];
  // Set mirror of index for O(1) has() and write() dedup checks.
  private readonly indexSet = new Set<string>();
  // This store's own subdir of STAGING_ROOT — isolates it from other tabs and is the unit clear()
  // removes. The timestamp prefix lets sweepStaleStagingDirs() tell live sessions from dead ones.
  private readonly sessionDir = newSessionDirName();
  // Resolved lazily and memoised: the directory handle is looked up once, not on every read/write.
  private dirHandle: FileSystemDirectoryHandle | null = null;

  private async stagingRoot(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(STAGING_ROOT, { create: true });
  }

  private async dir(): Promise<FileSystemDirectoryHandle> {
    if (!this.dirHandle) {
      const root = await this.stagingRoot();
      this.dirHandle = await root.getDirectoryHandle(this.sessionDir, { create: true });
    }
    return this.dirHandle;
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
    if (!this.indexSet.has(path)) { this.index.push(path); this.indexSet.add(path); }
  }

  has(path: string): boolean {
    return this.indexSet.has(path);
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
    // Remove only this session's subdir, never the shared root — a concurrent tab keeps its own.
    // Ignore "not found" so clear() is idempotent; drop the memoised handle so the next write()
    // recreates the (now-deleted) subdir.
    try {
      const root = await this.stagingRoot();
      await root.removeEntry(this.sessionDir, { recursive: true });
    } catch {
      /* this session's dir may not exist yet — nothing to clear */
    }
    this.dirHandle = null;
    this.index.length = 0;
    this.indexSet.clear();
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
 * Reclaim staging subdirectories left behind by earlier sessions (a tab closed or crashed before
 * clear() ran). Only entries older than `maxAgeMs` are removed, so a concurrently-open tab's fresh
 * session is never deleted; anything that isn't a recognisable, recent session subdir (stray files,
 * pre-subdir-layout leftovers, unparseable names) is reclaimed too. Best-effort — a missing root or
 * a per-entry failure (e.g. another tab holding the dir) is ignored. Call once at app startup.
 */
export async function sweepStaleStagingDirs(maxAgeMs: number = SESSION_TTL_MS): Promise<void> {
  if (!opfsAvailable()) return;
  const now = Date.now();

  let staging: FileSystemDirectoryHandle;
  try {
    const root = await navigator.storage.getDirectory();
    staging = await root.getDirectoryHandle(STAGING_ROOT);
  } catch {
    return; // nothing has been staged yet
  }

  // Collect first, then remove — don't mutate the directory while iterating it.
  const stale: string[] = [];
  try {
    const dir = staging as unknown as {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    };
    for await (const [name, handle] of dir.entries()) {
      const age = handle.kind === 'directory' ? sessionDirAgeMs(name, now) : null;
      if (age === null || age > maxAgeMs) stale.push(name);
    }
  } catch {
    return;
  }

  for (const name of stale) {
    try {
      await staging.removeEntry(name, { recursive: true });
    } catch {
      /* already gone, or held by another tab — leave it */
    }
  }
}

/**
 * Creates a staging store, preferring OPFS (on-disk, bounded heap) and falling back to an
 * in-memory store when OPFS isn't available. Pass `forceMemory` to opt out of OPFS (e.g. tests).
 */
export function createStagedFileStore(opts: { forceMemory?: boolean } = {}): StagedFileStore {
  return !opts.forceMemory && opfsAvailable() ? new OpfsFileStore() : new MemoryFileStore();
}

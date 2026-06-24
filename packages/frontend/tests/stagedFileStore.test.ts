import {
  createStagedFileStore,
  opfsAvailable,
  sweepStaleStagingDirs,
  type StagedFileStore,
} from "../src/staging/stagedFileStore";

// jsdom has no Blob.text(); read through FileReader (matches validatePsychDS.test.ts's helper).
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function collect(store: StagedFileStore): Promise<Array<[string, string]>> {
  const out: Array<[string, string]> = [];
  for await (const [path, blob] of store.entries()) out.push([path, await blobText(blob)]);
  return out;
}

// ── Minimal in-memory fake of the OPFS handles the store touches ──────────────
// Mirrors the navigator.storage.getDirectory() surface: nested directory handles, file handles
// with createWritable()/getFile(), and recursive removeEntry().
function installFakeOpfs() {
  class FakeFileHandle {
    readonly kind = "file" as const;
    constructor(private store: Map<string, Blob>, private key: string) {}
    async createWritable() {
      const parts: Array<string | Blob> = [];
      const store = this.store;
      const key = this.key;
      return {
        async write(chunk: string | Blob) { parts.push(chunk); },
        async close() { store.set(key, new Blob(parts)); },
      };
    }
    async getFile(): Promise<Blob> {
      const blob = this.store.get(this.key);
      if (!blob) throw new DOMException("NotFound", "NotFoundError");
      return blob;
    }
  }
  class FakeDirHandle {
    readonly kind = "directory" as const;
    files = new Map<string, Blob>();
    dirs = new Map<string, FakeDirHandle>();
    async *entries(): AsyncIterableIterator<[string, FakeDirHandle | FakeFileHandle]> {
      for (const [name, dir] of this.dirs) yield [name, dir];
      for (const [name] of this.files) yield [name, new FakeFileHandle(this.files, name)];
    }
    async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
      let d = this.dirs.get(name);
      if (!d) {
        if (!opts?.create) throw new DOMException("NotFound", "NotFoundError");
        d = new FakeDirHandle();
        this.dirs.set(name, d);
      }
      return d;
    }
    async getFileHandle(name: string, opts?: { create?: boolean }) {
      if (!this.files.has(name)) {
        if (!opts?.create) throw new DOMException("NotFound", "NotFoundError");
        this.files.set(name, new Blob([]));
      }
      return new FakeFileHandle(this.files, name);
    }
    async removeEntry(name: string, _opts?: { recursive?: boolean }) {
      if (!this.dirs.delete(name) && !this.files.delete(name)) {
        throw new DOMException("NotFound", "NotFoundError");
      }
    }
  }
  const root = new FakeDirHandle();
  (navigator as any).storage = { getDirectory: async () => root };
  return () => { delete (navigator as any).storage; };
}

describe("stagedFileStore — memory backend", () => {
  let store: StagedFileStore;
  beforeEach(() => { store = createStagedFileStore({ forceMemory: true }); });

  test("uses the memory backend when forced", () => {
    expect(store.backend).toBe("memory");
  });

  test("stores, reports, and reads back files in insertion order", async () => {
    await store.write("data/subject-1_data.csv", "a,b\n1,2");
    await store.write("data/raw/sub01.json", "[]");

    expect(store.has("data/subject-1_data.csv")).toBe(true);
    expect(store.has("missing.csv")).toBe(false);
    expect(store.paths()).toEqual(["data/subject-1_data.csv", "data/raw/sub01.json"]);
    await expect(blobText(await store.read("data/subject-1_data.csv"))).resolves.toBe("a,b\n1,2");
    expect(await collect(store)).toEqual([
      ["data/subject-1_data.csv", "a,b\n1,2"],
      ["data/raw/sub01.json", "[]"],
    ]);
  });

  test("accepts Blob content as well as strings", async () => {
    await store.write("data/x_data.csv", new Blob(["c,d\n3,4"]));
    await expect(blobText(await store.read("data/x_data.csv"))).resolves.toBe("c,d\n3,4");
  });

  test("clear() empties the store", async () => {
    await store.write("data/x_data.csv", "x");
    await store.clear();
    expect(store.paths()).toEqual([]);
    expect(store.has("data/x_data.csv")).toBe(false);
  });
});

describe("stagedFileStore — OPFS backend (faked)", () => {
  let uninstall: () => void;
  beforeEach(() => { uninstall = installFakeOpfs(); });
  afterEach(() => uninstall());

  test("selects the OPFS backend when navigator.storage.getDirectory exists", () => {
    expect(opfsAvailable()).toBe(true);
    expect(createStagedFileStore().backend).toBe("opfs");
  });

  test("round-trips a nested path through encoded OPFS filenames", async () => {
    const store = createStagedFileStore();
    await store.write("data/raw/sub 01.json", '{"ok":true}'); // space exercises path encoding
    await store.write("data/subject-1_data.csv", "a,b\n1,2");

    expect(store.paths()).toEqual(["data/raw/sub 01.json", "data/subject-1_data.csv"]);
    await expect(blobText(await store.read("data/raw/sub 01.json"))).resolves.toBe('{"ok":true}');
    expect(await collect(store)).toEqual([
      ["data/raw/sub 01.json", '{"ok":true}'],
      ["data/subject-1_data.csv", "a,b\n1,2"],
    ]);
  });

  test("clear() is idempotent even before anything is written", async () => {
    const store = createStagedFileStore();
    await expect(store.clear()).resolves.toBeUndefined();
    await store.write("data/x_data.csv", "x");
    await store.clear();
    expect(store.paths()).toEqual([]);
  });

  test("two stores are isolated — one's clear() leaves the other's files intact", async () => {
    // Per-session subdirs mean concurrent tabs never share (or delete) each other's staged data.
    const a = createStagedFileStore();
    const b = createStagedFileStore();
    await a.write("data/a_data.csv", "a");
    await b.write("data/b_data.csv", "b");

    await b.clear();

    expect(b.paths()).toEqual([]);
    await expect(blobText(await a.read("data/a_data.csv"))).resolves.toBe("a");
  });

  test("write() after clear() recreates the session subdir", async () => {
    const store = createStagedFileStore();
    await store.write("data/x_data.csv", "x");
    await store.clear();
    await store.write("data/y_data.csv", "y"); // must not throw on the removed handle
    expect(store.paths()).toEqual(["data/y_data.csv"]);
    await expect(blobText(await store.read("data/y_data.csv"))).resolves.toBe("y");
  });

  test("sweepStaleStagingDirs reclaims old/stray entries but keeps fresh sessions", async () => {
    const root = await (navigator as any).storage.getDirectory();
    const staging = await root.getDirectoryHandle("psychds-staging", { create: true });
    const now = Date.now();
    const oldName = `${(now - 1000 * 60 * 60 * 48).toString(36)}-dead`; // 48h ago
    const freshName = `${now.toString(36)}-live`;
    await staging.getDirectoryHandle(oldName, { create: true });
    await staging.getDirectoryHandle(freshName, { create: true });
    await staging.getFileHandle("stray-leftover", { create: true }); // pre-subdir-layout file

    await sweepStaleStagingDirs(); // default 24h TTL

    const remaining: string[] = [];
    for await (const [name] of (staging as any).entries()) remaining.push(name);
    expect(remaining).toEqual([freshName]);
  });

  test("sweepStaleStagingDirs is a no-op when nothing has been staged", async () => {
    await expect(sweepStaleStagingDirs()).resolves.toBeUndefined();
  });
});

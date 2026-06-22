import {
  createStagedFileStore,
  opfsAvailable,
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
    files = new Map<string, Blob>();
    dirs = new Map<string, FakeDirHandle>();
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
});

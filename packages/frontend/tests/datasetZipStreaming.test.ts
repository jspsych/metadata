// Verifies the memory-bounded contract of the zip builder: entries are compressed strictly one at
// a time, so entry N+1's deflater isn't created (and its bytes aren't pushed) until entry N has
// emitted its final chunk. fflate is faked so we can observe the exact ordering of create/push/final
// events — with the real (worker-backed) build this ordering isn't directly observable.

const mockEvents: string[] = [];

jest.mock('fflate', () => {
  class FakeAsyncZipDeflate {
    ondata: ((err: unknown, dat: Uint8Array, final: boolean) => void) | null = null;
    constructor(public filename: string) {
      mockEvents.push(`create:${filename}`);
    }
    push(data: Uint8Array, final: boolean) {
      mockEvents.push(`push:${this.filename}:${final}`);
      // Emit asynchronously so that a missing `await` between entries would let their pushes
      // interleave — the ordering assertions below would then fail.
      Promise.resolve().then(() => {
        this.ondata?.(null, data, final);
        if (final) mockEvents.push(`final:${this.filename}`);
      });
    }
  }
  class FakeZip {
    constructor(private cb: (err: unknown, dat: Uint8Array, final: boolean) => void) {}
    add(entry: FakeAsyncZipDeflate) {
      // Route an entry's chunks into the archive stream (never the whole-zip `final`).
      entry.ondata = (err, dat) => this.cb(err, dat, false);
    }
    end() {
      this.cb(null, new Uint8Array(0), true);
    }
  }
  return { Zip: FakeZip, AsyncZipDeflate: FakeAsyncZipDeflate };
});

import { buildDatasetZipBlob } from '../src/staging/datasetZip';
import { createStagedFileStore } from '../src/staging/stagedFileStore';

beforeEach(() => {
  mockEvents.length = 0;
});

test('compresses entries strictly sequentially (N+1 not started before N finishes)', async () => {
  const store = createStagedFileStore({ forceMemory: true });
  await store.write('data/a.csv', 'aaa');
  await store.write('data/b.csv', 'bbb');

  await buildDatasetZipBlob({ metadataJson: '{}', projectName: 'p', dataFiles: store });

  const order = ['dataset_description.json', 'data/a.csv', 'data/b.csv', 'README.md', 'CHANGES.md'];

  // Every entry was created and finished.
  for (const name of order) {
    expect(mockEvents).toContain(`create:${name}`);
    expect(mockEvents).toContain(`final:${name}`);
  }

  // Each entry finishes before the next is created or pushed.
  for (let i = 0; i < order.length - 1; i++) {
    const finalI = mockEvents.indexOf(`final:${order[i]}`);
    const createNext = mockEvents.indexOf(`create:${order[i + 1]}`);
    const pushNext = mockEvents.indexOf(`push:${order[i + 1]}:true`);
    expect(finalI).toBeGreaterThanOrEqual(0);
    expect(finalI).toBeLessThan(createNext);
    expect(finalI).toBeLessThan(pushNext);
  }
});

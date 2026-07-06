import { unzipSync } from 'fflate';
import { buildDatasetZipBlob, downloadDatasetZip } from '../src/staging/datasetZip';
import { createStagedFileStore } from '../src/staging/stagedFileStore';

async function readZip(blob: Blob): Promise<Record<string, string>> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const files = unzipSync(bytes);
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, new TextDecoder().decode(data)]),
  );
}

describe('buildDatasetZipBlob', () => {
  test('produces a valid zip containing metadata, README, and CHANGES', async () => {
    const blob = await buildDatasetZipBlob({
      metadataJson: '{"name":"test-project"}',
      projectName: 'test-project',
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);

    const files = await readZip(blob);
    expect(files['dataset_description.json']).toBe('{"name":"test-project"}');
    expect(files['README.md']).toBeDefined();
    expect(files['CHANGES.md']).toBeDefined();
  });

  test('README heading uses the project name', async () => {
    const blob = await buildDatasetZipBlob({ metadataJson: '{}', projectName: 'my-study' });
    const files = await readZip(blob);
    expect(files['README.md']).toContain('# my-study');
  });

  test('includes all staged data files', async () => {
    const store = createStagedFileStore({ forceMemory: true });
    await store.write('data/sub01.csv', 'col1,col2\n1,2');
    await store.write('data/sub02.csv', 'col1,col2\n3,4');

    const blob = await buildDatasetZipBlob({
      metadataJson: '{"name":"two-subjects"}',
      projectName: 'two-subjects',
      dataFiles: store,
    });

    const files = await readZip(blob);
    expect(files['data/sub01.csv']).toBe('col1,col2\n1,2');
    expect(files['data/sub02.csv']).toBe('col1,col2\n3,4');
  });

  test('metadata-only zip has no data/ entries', async () => {
    const blob = await buildDatasetZipBlob({
      metadataJson: '{"name":"no-data"}',
      projectName: 'no-data',
    });

    const files = await readZip(blob);
    expect(Object.keys(files).filter((k) => k.startsWith('data/'))).toHaveLength(0);
  });
});

type PickerWindow = { showSaveFilePicker?: (...args: unknown[]) => Promise<unknown> };
const pickerWindow = window as unknown as PickerWindow;

describe('downloadDatasetZip', () => {
  const originalPicker = pickerWindow.showSaveFilePicker;
  afterEach(() => {
    if (originalPicker === undefined) delete pickerWindow.showSaveFilePicker;
    else pickerWindow.showSaveFilePicker = originalPicker;
  });

  test('returns false when the user aborts the save dialog', async () => {
    pickerWindow.showSaveFilePicker = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }));

    const result = await downloadDatasetZip({ metadataJson: '{"name":"x"}', projectName: 'x' }, 'x.zip');
    expect(result).toBe(false);
  });

  test('streams to the picked file and returns true on success', async () => {
    const written: Uint8Array[] = [];
    const writable = {
      write: jest.fn(async (d: Uint8Array) => { written.push(d); }),
      close: jest.fn(async () => {}),
      abort: jest.fn(async () => {}),
    };
    pickerWindow.showSaveFilePicker = jest
      .fn()
      .mockResolvedValue({ createWritable: jest.fn().mockResolvedValue(writable) });

    const result = await downloadDatasetZip({ metadataJson: '{"name":"x"}', projectName: 'x' }, 'x.zip');
    expect(result).toBe(true);
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalled();
    expect(writable.abort).not.toHaveBeenCalled();
  });

  test('propagates streaming errors and aborts the sink', async () => {
    const writable = {
      write: jest.fn().mockRejectedValue(new Error('disk full')),
      close: jest.fn(async () => {}),
      abort: jest.fn(async () => {}),
    };
    pickerWindow.showSaveFilePicker = jest
      .fn()
      .mockResolvedValue({ createWritable: jest.fn().mockResolvedValue(writable) });

    await expect(
      downloadDatasetZip({ metadataJson: '{"name":"x"}', projectName: 'x' }, 'x.zip'),
    ).rejects.toThrow('disk full');
    expect(writable.abort).toHaveBeenCalled();
    expect(writable.close).not.toHaveBeenCalled();
  });

  test('falls back to a blob download when the file-system picker is unavailable', async () => {
    delete pickerWindow.showSaveFilePicker;
    const result = await downloadDatasetZip({ metadataJson: '{"name":"x"}', projectName: 'x' }, 'x.zip');
    expect(result).toBe(true);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});

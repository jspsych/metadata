import { useState, useMemo } from 'react';
import JSZip from 'jszip';
import JsPsychMetadata from '@jspsych/metadata';
import styles from './Review.module.css';

interface ReviewProps {
  jsPsychMetadata: JsPsychMetadata;
  dataFiles?: Map<string, { content: string; type: string }>;
}

const FILENAME = 'dataset_description.json';

function blobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dataFilePath(originalPath: string): string {
  // Strip the top-level folder (e.g. "my-experiment/sub01.csv" → "data/sub01.csv")
  const parts = originalPath.split('/');
  const relative = parts.length > 1 ? parts.slice(1).join('/') : originalPath;
  return `data/${relative}`;
}

const Review: React.FC<ReviewProps> = ({ jsPsychMetadata, dataFiles }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [zipped, setZipped] = useState(false);

  const metadataJson = useMemo(() => JSON.stringify(jsPsychMetadata.getMetadata(), null, 2), []);

  const projectName = useMemo(() => {
    const name = jsPsychMetadata.getMetadataField('name') as string | undefined;
    return name?.trim() || 'dataset';
  }, []);

  // Data files eligible for the zip: JSON/CSV that aren't dataset_description.json
  const zipEligibleFiles = useMemo(() => {
    if (!dataFiles || dataFiles.size === 0) return new Map<string, string>();
    const out = new Map<string, string>();
    for (const [path, { content, type }] of dataFiles) {
      if (type !== 'json' && type !== 'csv') continue;
      if (path === FILENAME || path.endsWith(`/${FILENAME}`)) continue;
      out.set(path, content);
    }
    return out;
  }, [dataFiles]);

  const hasDataFiles = zipEligibleFiles.size > 0;

  const handleDownload = async () => {
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: FILENAME,
          types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(metadataJson);
        await writable.close();
        setDownloaded(true);
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        blobDownload(new Blob([metadataJson], { type: 'application/json' }), FILENAME);
        setDownloaded(true);
      }
    } else {
      blobDownload(new Blob([metadataJson], { type: 'application/json' }), FILENAME);
      setDownloaded(true);
    }
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    zip.file(FILENAME, metadataJson);
    for (const [originalPath, content] of zipEligibleFiles) {
      zip.file(dataFilePath(originalPath), content);
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    blobDownload(blob, `${projectName}.zip`);
    setZipped(true);
  };

  const usesFilePicker = 'showSaveFilePicker' in window;

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Review & Download</h2>

      <p className={styles.subtext}>
        This is your <code className={styles.code}>dataset_description.json</code>. Go back to any
        step to make changes, then download when ready.
      </p>

      <div className={styles.jsonBlock}>
        <pre className={styles.json}>{metadataJson}</pre>
      </div>

      <div className={styles.actions}>
        {hasDataFiles ? (
          <>
            <div className={styles.actionGroup}>
              <button className={styles.downloadBtn} onClick={handleDownloadZip}>
                {zipped ? '✓ Downloaded' : `Download ${projectName}.zip`}
              </button>
              <p className={styles.saveHint}>
                Includes <code className={styles.code}>dataset_description.json</code> and your data files in a <code className={styles.code}>data/</code> folder — ready to validate.
              </p>
            </div>
            <div className={styles.actionGroup}>
              <button className={styles.saveJsonBtn} onClick={handleDownload}>
                {downloaded ? '✓ Saved' : `Save ${FILENAME} only`}
              </button>
              {usesFilePicker && !downloaded && (
                <p className={styles.saveHint}>
                  Navigate to your dataset folder in the save dialog so the file lands next to your <code className={styles.code}>data/</code> folder.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className={styles.actionGroup}>
            <button className={styles.downloadBtn} onClick={handleDownload}>
              {downloaded ? '✓ Saved' : `Save ${FILENAME}`}
            </button>
            {usesFilePicker && !downloaded && (
              <p className={styles.saveHint}>
                Navigate to your dataset folder in the save dialog so the file lands next to your <code className={styles.code}>data/</code> folder — then it's ready to validate.
              </p>
            )}
          </div>
        )}
      </div>

      <div className={styles.validatorNote}>
        <p className={styles.validatorTitle}>Validate your dataset</p>
        <p className={styles.validatorText}>
          Once <code className={styles.code}>dataset_description.json</code> is in your dataset folder, run the validator from the command line:
        </p>
        <pre className={styles.cliBlock}>npx @jspsych/cli validate</pre>
        <p className={styles.validatorText}>
          Or with a specific path:
        </p>
        <pre className={styles.cliBlock}>npx @jspsych/cli validate --psych-ds-dir ./your-dataset</pre>
      </div>
    </div>
  );
};

export default Review;

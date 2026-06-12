import { useState, useMemo } from 'react';
import JSZip from 'jszip';
import JsPsychMetadata from '@jspsych/metadata';
import JsonViewer from '../components/JsonViewer';
import PageHeader from '../components/PageHeader';
import { DATASET_DESCRIPTION_FILENAME as FILENAME } from '../datasetLayout';
import type { PsychDSValidationResult } from '../validation/validatePsychDS';
import styles from './Review.module.css';

interface ReviewProps {
  jsPsychMetadata: JsPsychMetadata;
  /**
   * Psych-DS `data/` payload (dataset-relative path → contents, e.g. `data/subject-sub01_data.csv`),
   * already converted to compliant CSV by the upload step. Drives both validation and the zip.
   */
  dataFiles?: Map<string, string>;
}

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

type ValidationStatus = 'idle' | 'running' | 'done' | 'unavailable';

const Review: React.FC<ReviewProps> = ({ jsPsychMetadata, dataFiles }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [zipped, setZipped] = useState(false);
  const [valStatus, setValStatus] = useState<ValidationStatus>('idle');
  const [valResult, setValResult] = useState<PsychDSValidationResult | null>(null);
  const [valError, setValError] = useState<string | null>(null);

  // Review is unmounted whenever the user navigates away, so each visit gets a fresh snapshot.
  const metadataObj = useMemo(() => jsPsychMetadata.getMetadata(), []);
  const metadataJson = useMemo(() => JSON.stringify(metadataObj, null, 2), [metadataObj]);

  const projectName = useMemo(() => {
    const name = jsPsychMetadata.getMetadataField('name') as string | undefined;
    return name?.trim() || 'dataset';
  }, []);

  // Converted Psych-DS data/ payload (paths already include `data/`); drives validation + zip.
  const dataPayload = useMemo(() => dataFiles ?? new Map<string, string>(), [dataFiles]);
  const hasDataFiles = dataPayload.size > 0;

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
    for (const [path, content] of dataPayload) {
      zip.file(path, content); // path already includes the `data/` prefix
    }
    zip.file('README.md', `# ${projectName}\nHuman-readable description of the project and dataset.`);
    zip.file('CHANGES.md', 'For version tracking — if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    blobDownload(blob, `${projectName}.zip`);
    setZipped(true);
  };

  const handleValidate = async () => {
    setValStatus('running');
    setValError(null);
    try {
      // Lazy-loaded so the ~260 KB validator bundle stays out of the initial load.
      const { validatePsychDS } = await import('../validation/validatePsychDS');
      const result = await validatePsychDS(metadataJson, dataPayload);
      setValResult(result);
      setValStatus('done');
    } catch (err) {
      setValResult(null);
      setValError(
        err instanceof Error && err.name === 'ValidationUnavailableError'
          ? err.message
          : `Validation failed unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
      );
      setValStatus('unavailable');
    }
  };

  const usesFilePicker = 'showSaveFilePicker' in window;

  return (
    <>
      <PageHeader title="Review & Download" />
      <div className={styles.page}>

      <p className={styles.subtext}>
        This is your <code className={styles.code}>dataset_description.json</code>. Go back to any
        step to make changes, then download when ready.
      </p>

      <div className={styles.jsonBlock}>
        <JsonViewer data={metadataObj} />
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
          Check this metadata{hasDataFiles ? ' and your data files' : ''} against the
          Psych-DS standard right here. Validation runs in your browser and needs an
          internet connection to fetch the schema.
        </p>

        <button
          className={styles.validateBtn}
          onClick={handleValidate}
          disabled={valStatus === 'running'}
        >
          {valStatus === 'running'
            ? 'Validating…'
            : valStatus === 'idle'
              ? 'Validate dataset'
              : 'Re-validate'}
        </button>

        {valStatus === 'unavailable' && valError && (
          <div className={`${styles.resultBanner} ${styles.resultUnavailable}`}>
            {valError}
          </div>
        )}

        {valStatus === 'done' && valResult && (
          <>
            <div
              className={`${styles.resultBanner} ${
                valResult.valid ? styles.resultValid : styles.resultInvalid
              }`}
            >
              {valResult.valid
                ? '✓ Valid Psych-DS dataset'
                : `✗ ${valResult.errors.length} error${valResult.errors.length !== 1 ? 's' : ''} found`}
              {valResult.warnings.length > 0 &&
                ` · ${valResult.warnings.length} warning${valResult.warnings.length !== 1 ? 's' : ''}`}
            </div>

            {valResult.errors.length > 0 && (
              <>
                <p className={styles.issueGroupLabel}>Errors</p>
                <ul className={styles.issueList}>
                  {valResult.errors.map((issue, i) => (
                    <li key={`e${i}`} className={styles.issueItem}>
                      <span className={styles.issueKey}>{issue.key}</span>
                      <span className={styles.issueReason}>{issue.reason}</span>
                      {issue.evidence.map((ev, j) => (
                        <span key={j} className={styles.issueEvidence}>{ev}</span>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {valResult.warnings.length > 0 && (
              <>
                <p className={styles.issueGroupLabel}>Warnings</p>
                <ul className={styles.issueList}>
                  {valResult.warnings.map((issue, i) => (
                    <li key={`w${i}`} className={`${styles.issueItem} ${styles.issueWarn}`}>
                      <span className={styles.issueKey}>{issue.key}</span>
                      <span className={styles.issueReason}>{issue.reason}</span>
                      {issue.evidence.map((ev, j) => (
                        <span key={j} className={styles.issueEvidence}>{ev}</span>
                      ))}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <details className={styles.cliAlt}>
          <summary className={styles.cliAltSummary}>Prefer the command line?</summary>
          <p className={styles.validatorText}>
            Once <code className={styles.code}>dataset_description.json</code> is in your dataset folder, run:
          </p>
          <pre className={styles.cliBlock}>npx @jspsych/cli validate</pre>
          <pre className={styles.cliBlock}>npx @jspsych/cli validate --psych-ds-dir ./your-dataset</pre>
        </details>
      </div>
    </div>
    </>
  );
};

export default Review;

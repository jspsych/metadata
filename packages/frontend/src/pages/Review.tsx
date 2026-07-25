import { useState, useMemo } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import JsonViewer from '../components/JsonViewer';
import { DATASET_DESCRIPTION_FILENAME as FILENAME } from '../datasetLayout';
import { downloadDatasetZip } from '../staging/datasetZip';
import { blobDownload } from '../download';
import type { StagedFileStore } from '../staging/stagedFileStore';
import type { PsychDSValidationResult } from '../validation/validatePsychDS';
import styles from './Review.module.css';

interface ReviewProps {
  jsPsychMetadata: JsPsychMetadata;
  /**
   * Staged Psych-DS `data/` payload (dataset-relative paths, e.g. `data/subject-sub01_data.csv`),
   * already converted to compliant CSV by the upload step and held on disk (OPFS). Read one file
   * at a time to drive both validation and the zip. Null/absent when no data was uploaded.
   */
  dataFiles?: StagedFileStore | null;
  /** Called after a successful download so the shell can drop its unsaved-work unload guard. */
  onDownloaded?: () => void;
}

type ValidationStatus = 'idle' | 'running' | 'done' | 'unavailable';

/** Strip characters that are invalid in filenames on common platforms so the .zip name is safe. */
function sanitizeFilename(name: string): string {
  // Replace the characters reserved/illegal on Windows + POSIX (and any whitespace) with '_', then
  // drop trailing dots (invalid on Windows). Falls back to "dataset" if nothing usable remains.
  const cleaned = name.replace(/[<>:"/\\|?*\s]/g, '_').replace(/\.+$/, '');
  return cleaned || 'dataset';
}

const Review: React.FC<ReviewProps> = ({ jsPsychMetadata, dataFiles, onDownloaded }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [zipped, setZipped] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
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

  // Staged Psych-DS data/ payload (paths already include `data/`); drives validation + zip.
  const hasDataFiles = useMemo(() => (dataFiles?.paths().length ?? 0) > 0, [dataFiles]);

  const handleDownload = async () => {
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (
          window as unknown as {
            showSaveFilePicker: (
              opts: unknown,
            ) => Promise<{ createWritable: () => Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
          }
        ).showSaveFilePicker({
          suggestedName: FILENAME,
          types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(metadataJson);
        await writable.close();
        setDownloaded(true);
        onDownloaded?.();
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        blobDownload(new Blob([metadataJson], { type: 'application/json' }), FILENAME);
        setDownloaded(true);
        onDownloaded?.();
      }
    } else {
      blobDownload(new Blob([metadataJson], { type: 'application/json' }), FILENAME);
      setDownloaded(true);
      onDownloaded?.();
    }
  };

  const handleDownloadZip = async () => {
    if (zipping) return;
    setZipError(null);
    setZipping(true);
    try {
      const didDownload = await downloadDatasetZip(
        { metadataJson, projectName, dataFiles: dataFiles ?? undefined },
        `${sanitizeFilename(projectName)}.zip`,
      );
      if (didDownload) { setZipped(true); onDownloaded?.(); }
    } catch (err) {
      setZipError(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setZipping(false);
    }
  };

  const handleValidate = async () => {
    setValStatus('running');
    setValError(null);
    try {
      // Lazy-loaded so the ~260 KB validator bundle stays out of the initial load.
      const { validatePsychDS } = await import('../validation/validatePsychDS');
      // hasDataFiles ⇒ the user downloads a zip, which ships README.md / CHANGES.md; pass the
      // project name so those are validated alongside the metadata and data.
      const result = await validatePsychDS(
        metadataJson,
        dataFiles ?? undefined,
        hasDataFiles ? projectName : undefined,
      );
      setValResult(result);
      setValStatus('done');
    } catch (err) {
      setValResult(null);
      setValError(
        err instanceof Error && err.name === 'ValidationUnavailableError'
          ? err.message
          : `Validation couldn't finish: ${err instanceof Error ? err.message : String(err)}`,
      );
      setValStatus('unavailable');
    }
  };

  const usesFilePicker = 'showSaveFilePicker' in window;

  return (
    <>
      <h2 className="srOnly">Review</h2>
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
              <button className={styles.downloadBtn} onClick={handleDownloadZip} disabled={zipping}>
                {zipping ? 'Preparing…' : zipped ? '✓ Downloaded' : `Download ${projectName}.zip`}
              </button>
              {zipError && (
                <div className={`${styles.resultBanner} ${styles.resultUnavailable}`} role="alert">
                  {zipError}
                </div>
              )}
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
                  In the save dialog, pick your existing dataset folder so this file sits next to your <code className={styles.code}>data/</code> folder.
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
                In the save dialog, pick your existing dataset folder so this file sits next to your <code className={styles.code}>data/</code> folder — then it's ready to validate.
              </p>
            )}
          </div>
        )}
      </div>

      <div className={styles.validatorNote}>
        <p className={styles.validatorTitle}>Validate your dataset</p>
        <p className={styles.validatorText}>
          Check this metadata{hasDataFiles ? ' and your data files' : ''} against the
          Psych-DS standard without leaving the page. It runs in your browser, and needs
          an internet connection to fetch the standard's schema.
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

        <div aria-live="polite">
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
                <p className={styles.warnNote}>
                  Warnings don't make a dataset invalid — they point at recommended metadata you
                  haven't filled in.
                </p>
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
        </div>
      </div>
    </div>
    </>
  );
};

export default Review;

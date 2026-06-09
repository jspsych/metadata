import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import styles from './Review.module.css';

interface ReviewProps {
  jsPsychMetadata: JsPsychMetadata;
}

const FILENAME = 'dataset_description.json';

function blobDownload(json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const Review: React.FC<ReviewProps> = ({ jsPsychMetadata }) => {
  const [downloaded, setDownloaded] = useState(false);
  const [saveError, setSaveError] = useState('');

  const metadataJson = JSON.stringify(jsPsychMetadata.getMetadata(), null, 2);

  const handleDownload = async () => {
    setSaveError('');
    const json = metadataJson;

    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: FILENAME,
          types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        setDownloaded(true);
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return; // user cancelled
        // showSaveFilePicker failed for another reason — fall back to blob download
        blobDownload(json);
        setDownloaded(true);
      }
    } else {
      blobDownload(json);
      setDownloaded(true);
    }
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
        <button className={styles.downloadBtn} onClick={handleDownload}>
          {downloaded ? '✓ Saved' : `Save ${FILENAME}`}
        </button>
        {usesFilePicker && !downloaded && (
          <p className={styles.saveHint}>
            Navigate to your dataset folder in the save dialog so the file lands next to your <code className={styles.code}>data/</code> folder — then it's ready to validate.
          </p>
        )}
        {saveError && <p className={styles.saveError}>{saveError}</p>}
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

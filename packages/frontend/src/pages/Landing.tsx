import { useRef, useState } from 'react';
import styles from './Landing.module.css';

interface LandingProps {
  onStart: (isNew: boolean, file?: File) => void;
}

const Landing: React.FC<LandingProps> = ({ onStart }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [psychDsOpen, setPsychDsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onStart(false, file);
  };

  return (
    <div className={styles.landing}>
      <div className={styles.header}>
        <h1 className={styles.title}>jsPsych Metadata Generator</h1>
        <p className={styles.description}>
          Generate Psych-DS compliant metadata for your jsPsych experiments.
        </p>
      </div>

      <div className={styles.cards}>
        <button className={styles.card} onClick={() => onStart(true)}>
          <span className={styles.cardIcon}>+</span>
          <span className={styles.cardTitle}>Create new project</span>
          <span className={styles.cardDesc}>
            Start from scratch with your experiment data files
          </span>
        </button>

        <button className={styles.card} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.cardIcon}>↑</span>
          <span className={styles.cardTitle}>Open existing project</span>
          <span className={styles.cardDesc}>
            Upload a <code>dataset_description.json</code> to continue editing
          </span>
        </button>
      </div>

      <div className={styles.psychDs}>
        <button
          className={styles.psychDsToggle}
          onClick={() => setPsychDsOpen(o => !o)}
          aria-expanded={psychDsOpen}
        >
          <span>What is Psych-DS?</span>
          <span className={styles.chevron}>{psychDsOpen ? '▲' : '▼'}</span>
        </button>
        {psychDsOpen && (
          <p className={styles.psychDsText}>
            Psych-DS is an open standard for organizing and documenting psychological
            datasets. It defines a consistent folder structure and a metadata file
            (<code>dataset_description.json</code>) that makes your experiment data
            easier to share, archive, and reuse.{' '}
            <a
              href="https://psychds-docs.readthedocs.io/en/latest/"
              target="_blank"
              rel="noreferrer"
            >
              Read the documentation →
            </a>
          </p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};

export default Landing;

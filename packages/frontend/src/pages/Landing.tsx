import { useRef, useState } from 'react';
import styles from './Landing.module.css';
import logo from '../assets/jspsych-logo-no-text.svg';

interface LandingProps {
  onStart: (isNew: boolean, file?: File) => void;
  /**
   * True when the wizard runs inside the docs-site iframe. The surrounding page
   * already supplies the brand, title, description, and a Psych-DS explainer, so
   * the embedded entry drops the standalone hero for a lean start screen.
   */
  embedded?: boolean;
}

const Landing: React.FC<LandingProps> = ({ onStart, embedded = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [psychDsOpen, setPsychDsOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onStart(false, file);
  };

  return (
    <div className={`${styles.landing} ${embedded ? styles.embedded : ''}`}>
      {embedded ? (
        <h2 className={styles.leanHeading}>Start a metadata file</h2>
      ) : (
        <>
          <div className={styles.header}>
            <img src={logo} alt="jsPsych" className={styles.logo} />
            <h1 className={styles.title}>jsPsych Metadata Generator</h1>
            <p className={styles.description}>
              Generate Psych-DS compliant metadata for your jsPsych experiments.
            </p>
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
                  href="https://metadata.jspsych.org/docs/introduction"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more →
                </a>
              </p>
            )}
          </div>
        </>
      )}

      <div className={styles.cards}>
        <button className={styles.card} onClick={() => onStart(true)}>
          <span className={styles.cardIcon}>+</span>
          <span className={styles.cardTitle}>Create new project</span>
          <span className={styles.cardDesc}>
            Start from scratch with the data files from your experiment
          </span>
        </button>

        <button className={styles.card} onClick={() => fileInputRef.current?.click()}>
          <span className={styles.cardIconAmber}>↑</span>
          <span className={styles.cardTitle}>Open existing project</span>
          <span className={styles.cardDesc}>
            Upload a <code>dataset_description.json</code> you generated before, to keep editing it
          </span>
        </button>
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

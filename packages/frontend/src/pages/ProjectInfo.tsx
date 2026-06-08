import { useState, useEffect } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import styles from './ProjectInfo.module.css';

interface ProjectInfoProps {
  jsPsychMetadata: JsPsychMetadata;
  existingMetadataFile?: File;
  onComplete: () => void;
}

const OPTIONAL_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'license',       label: 'License',        hint: 'URL or name of the license for this dataset' },
  { key: 'citation',      label: 'Citation',        hint: 'How to cite this dataset (URL or scholarly reference)' },
  { key: 'url',           label: 'URL',             hint: 'Canonical source URL for this dataset' },
  { key: 'funder',        label: 'Funder',          hint: 'Source(s) of funding — grant numbers or organization names' },
  { key: 'identifier',    label: 'Identifier',      hint: 'Unique identifier such as a DOI or PMID' },
  { key: 'privacyPolicy', label: 'Privacy policy',  hint: 'One of: open, private, open_deidentified, open_redacted' },
  { key: 'keywords',      label: 'Keywords',        hint: 'Comma-separated keywords to assist search' },
];

type OptionalValues = Record<string, string>;

const ProjectInfo: React.FC<ProjectInfoProps> = ({ jsPsychMetadata, existingMetadataFile, onComplete }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [optional, setOptional] = useState<OptionalValues>(
    Object.fromEntries(OPTIONAL_FIELDS.map(f => [f.key, '']))
  );
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existingMetadataFile) return;
    setLoadStatus('loading');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        jsPsychMetadata.loadMetadata(reader.result as string);
        setName(jsPsychMetadata.getMetadataField('name') || '');
        setDescription(jsPsychMetadata.getMetadataField('description') || '');
        setOptional(
          Object.fromEntries(
            OPTIONAL_FIELDS.map(f => [f.key, jsPsychMetadata.getMetadataField(f.key) || ''])
          )
        );
        const hasOptional = OPTIONAL_FIELDS.some(f => jsPsychMetadata.getMetadataField(f.key));
        if (hasOptional) setOptionalOpen(true);
        setLoadStatus('loaded');
      } catch {
        setLoadStatus('error');
        setError('Failed to parse the metadata file — check that it is valid JSON.');
      }
    };
    reader.onerror = () => {
      setLoadStatus('error');
      setError('Failed to read the file.');
    };
    reader.readAsText(existingMetadataFile);
  }, [existingMetadataFile]);

  const handleContinue = () => {
    if (!name.trim()) { setError('Project name is required.'); return; }
    if (!description.trim()) { setError('Description is required.'); return; }
    setError('');

    jsPsychMetadata.setMetadataField('name', name.trim());
    jsPsychMetadata.setMetadataField('description', description.trim());

    for (const { key } of OPTIONAL_FIELDS) {
      const val = optional[key].trim();
      if (val) jsPsychMetadata.setMetadataField(key, val);
    }

    onComplete();
  };

  if (loadStatus === 'loading') {
    return <div className={styles.loading}>Loading existing metadata…</div>;
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Project Info</h2>

      {loadStatus === 'loaded' && (
        <p className={styles.loadedBanner}>
          ✓ Loaded from <code>dataset_description.json</code>
        </p>
      )}

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>
            Project name <span className={styles.required}>*</span>
          </label>
          <p className={styles.hint}>The name of your dataset</p>
          <input
            className={styles.input}
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. my-stroop-experiment"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Description <span className={styles.required}>*</span>
          </label>
          <p className={styles.hint}>A brief description of your experiment and dataset</p>
          <textarea
            className={styles.textarea}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Stroop task data collected from 40 participants…"
            rows={3}
          />
        </div>

        <div className={styles.optionalSection}>
          <button
            className={styles.optionalToggle}
            onClick={() => setOptionalOpen(o => !o)}
            aria-expanded={optionalOpen}
          >
            <span>Optional fields</span>
            <span className={styles.chevron}>{optionalOpen ? '▲' : '▼'}</span>
          </button>

          {optionalOpen && (
            <div className={styles.optionalFields}>
              {OPTIONAL_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className={styles.field}>
                  <label className={styles.label}>{label}</label>
                  <p className={styles.hint}>{hint}</p>
                  <input
                    className={styles.input}
                    type="text"
                    value={optional[key]}
                    onChange={e => setOptional(prev => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button className={styles.continueBtn} onClick={handleContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
};

export default ProjectInfo;

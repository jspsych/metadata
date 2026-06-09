import { useState, useEffect } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import styles from './ProjectInfo.module.css';

export const OPTIONAL_FIELDS: { key: string; label: string; hint: string; help?: string; options?: readonly string[] }[] = [
  { key: 'license',    label: 'License',    hint: 'URL or SPDX identifier for the license', help: 'A license tells others what they can do with your data. Common choices for open research data: CC0 (public domain — no restrictions), CC-BY-4.0 (free to use with attribution). You can enter a standard identifier (e.g. CC-BY-4.0) or a URL to the full license text. If your institution has a data-sharing policy, check there first.' },
  { key: 'keywords',   label: 'Keywords',   hint: 'Comma-separated keywords to assist search' },
  { key: 'citation',   label: 'Citation',   hint: 'How to cite this dataset (URL or scholarly reference)' },
  { key: 'url',        label: 'URL',        hint: 'Canonical source URL for this dataset' },
  { key: 'funder',     label: 'Funder',     hint: 'Source(s) of funding — grant numbers or organization names' },
  { key: 'identifier', label: 'Identifier', hint: 'Unique identifier such as a DOI or PMID' },
  { key: 'privacyPolicy', label: 'Privacy policy', hint: 'How data access is restricted for this dataset', options: ['', 'open', 'private', 'open_deidentified', 'open_redacted'],
    help: 'Choose the option that matches your IRB approval or data-sharing agreement:\n• open — data can be shared publicly without restriction\n• open_deidentified — data can be shared after removing directly identifying information (names, dates of birth, etc.)\n• open_redacted — data can be shared after removing specific sensitive fields\n• private — data is not to be shared outside your team' },
];

export type ProjectInfoSession = {
  name: string;
  description: string;
  optional: Record<string, string>;
  optionalOpen: boolean;
};

export const emptyProjectInfoSession = (): ProjectInfoSession => ({
  name: '',
  description: '',
  optional: Object.fromEntries(OPTIONAL_FIELDS.map(f => [f.key, ''])),
  optionalOpen: false,
});

interface ProjectInfoProps {
  jsPsychMetadata: JsPsychMetadata;
  existingMetadataFile?: File;
  session: ProjectInfoSession;
  onSessionChange: (s: ProjectInfoSession) => void;
  onComplete: () => void;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({
  jsPsychMetadata,
  existingMetadataFile,
  session,
  onSessionChange,
  onComplete,
}) => {
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const toggleHelp = (key: string) => setHelpOpen(prev => prev === key ? null : key);

  useEffect(() => {
    if (!existingMetadataFile) return;
    setLoadStatus('loading');
    const reader = new FileReader();
    reader.onload = () => {
      try {
        jsPsychMetadata.loadMetadata(reader.result as string);
        const optionalVals = Object.fromEntries(
          OPTIONAL_FIELDS.map(f => [f.key, jsPsychMetadata.getMetadataField(f.key) as string || ''])
        );
        onSessionChange({
          name: jsPsychMetadata.getMetadataField('name') as string || '',
          description: jsPsychMetadata.getMetadataField('description') as string || '',
          optional: optionalVals,
          optionalOpen: OPTIONAL_FIELDS.some(f => !!jsPsychMetadata.getMetadataField(f.key)),
        });
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

  const set = (patch: Partial<ProjectInfoSession>) =>
    onSessionChange({ ...session, ...patch });

  const setOptionalField = (key: string, value: string) =>
    set({ optional: { ...session.optional, [key]: value } });

  const handleContinue = () => {
    if (!session.name.trim()) { setError('Project name is required.'); return; }
    if (!session.description.trim()) { setError('Description is required.'); return; }
    setError('');

    jsPsychMetadata.setMetadataField('name', session.name.trim());
    jsPsychMetadata.setMetadataField('description', session.description.trim());

    for (const { key } of OPTIONAL_FIELDS) {
      const val = (session.optional[key] ?? '').trim();
      if (val) {
        jsPsychMetadata.setMetadataField(key, val);
      } else {
        jsPsychMetadata.deleteMetadataField(key);
      }
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
          <label className={styles.label} htmlFor="project-name">
            Project name <span className={styles.required}>*</span>
          </label>
          <p className={styles.hint}>The name of your dataset</p>
          <input
            id="project-name"
            className={styles.input}
            type="text"
            value={session.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="e.g. my-stroop-experiment"
          />
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="project-description">
              Description <span className={styles.required}>*</span>
            </label>
            <button
              type="button"
              className={styles.helpBtn}
              onClick={() => toggleHelp('description')}
              aria-expanded={helpOpen === 'description'}
              aria-label="Help for Description"
            >ⓘ</button>
          </div>
          {helpOpen === 'description' && (
            <div className={styles.helpBlock}>
              A good description helps others understand your dataset. Include: what the experiment measured (e.g. response time, accuracy), the task or paradigm (e.g. Stroop, n-back), roughly how many participants, and any key conditions or manipulations.
              <br /><br />
              <em>Example: "Stroop task data from 40 undergraduates (20 control, 20 ADHD), measuring response time and accuracy across congruent and incongruent conditions."</em>
            </div>
          )}
          <textarea
            id="project-description"
            className={styles.textarea}
            value={session.description}
            onChange={e => set({ description: e.target.value })}
            placeholder="e.g. Stroop task data collected from 40 participants…"
            rows={3}
          />
        </div>

        <div className={styles.optionalSection}>
          <button
            className={styles.optionalToggle}
            onClick={() => set({ optionalOpen: !session.optionalOpen })}
            aria-expanded={session.optionalOpen}
          >
            <span>
              Optional fields{' '}
              <span className={styles.optionalHint}>(license, keywords, citation…)</span>
            </span>
            <span className={styles.chevron}>{session.optionalOpen ? '▲' : '▼'}</span>
          </button>

          {session.optionalOpen && (
            <div className={styles.optionalFields}>
              {OPTIONAL_FIELDS.map(({ key, label, hint, help, options }) => (
                <div key={key} className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor={`project-${key}`}>{label}</label>
                    {help && (
                      <button
                        type="button"
                        className={styles.helpBtn}
                        onClick={() => toggleHelp(key)}
                        aria-expanded={helpOpen === key}
                        aria-label={`Help for ${label}`}
                      >ⓘ</button>
                    )}
                  </div>
                  {help && helpOpen === key && (
                    <div className={styles.helpBlock}>
                      {help.split('\n').map((line, i) => line ? <p key={i} className={styles.helpLine}>{line}</p> : null)}
                    </div>
                  )}
                  <p className={styles.hint}>{hint}</p>
                  {options ? (
                    <select
                      id={`project-${key}`}
                      className={styles.select}
                      value={session.optional[key] ?? ''}
                      onChange={e => setOptionalField(key, e.target.value)}
                    >
                      {options.map(opt => (
                        <option key={opt} value={opt}>{opt === '' ? '— not set —' : opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`project-${key}`}
                      className={styles.input}
                      type="text"
                      value={session.optional[key] ?? ''}
                      onChange={e => setOptionalField(key, e.target.value)}
                    />
                  )}
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

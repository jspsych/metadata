import { useState, useEffect, useRef } from 'react';
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
  const [pendingUpload, setPendingUpload] = useState<Record<string, string> | null>(null);
  const [conflictFields, setConflictFields] = useState<string[]>([]);
  const [conflictExpanded, setConflictExpanded] = useState(false);
  const [uploadHelpOpen, setUploadHelpOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

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

  const applyUpload = (data: Record<string, string>, overwritePrimary: boolean) => {
    const patch: Partial<ProjectInfoSession> = {};
    if (overwritePrimary) {
      if (data.name !== undefined) patch.name = data.name;
      if (data.description !== undefined) patch.description = data.description;
    }
    const newOptional = { ...session.optional };
    for (const { key } of OPTIONAL_FIELDS) {
      if (data[key] !== undefined) newOptional[key] = data[key];
    }
    patch.optional = newOptional;
    if (OPTIONAL_FIELDS.some(f => data[f.key] !== undefined)) patch.optionalOpen = true;
    onSessionChange({ ...session, ...patch });
    setPendingUpload(null);
    setConflictFields([]);
    setConflictExpanded(false);
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, unknown>;
        const parsed: Record<string, string> = {};
        if (typeof data.name === 'string') parsed.name = data.name;
        if (typeof data.description === 'string') parsed.description = data.description;
        for (const { key } of OPTIONAL_FIELDS) {
          const val = data[key];
          if (typeof val === 'string') parsed[key] = val;
          else if (Array.isArray(val)) parsed[key] = val.join(', ');
        }

        const conflicts: string[] = [];
        if (parsed.name !== undefined && session.name.trim() && parsed.name !== session.name.trim()) conflicts.push('name');
        if (parsed.description !== undefined && session.description.trim() && parsed.description !== session.description.trim()) conflicts.push('description');

        if (conflicts.length > 0) {
          setPendingUpload(parsed);
          setConflictFields(conflicts);
        } else {
          applyUpload(parsed, true);
        }
      } catch {
        setError('Could not parse the uploaded JSON file — check that it is valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleContinue = () => {
    if (!session.name.trim()) { setError('Project name is required.'); return; }
    setError('');

    jsPsychMetadata.setMetadataField('name', session.name.trim());
    jsPsychMetadata.setMetadataField('description', session.description.trim() || 'No description provided.');

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
        <div className={styles.uploadSection}>
          <div className={styles.uploadRow}>
            <input
              ref={uploadInputRef}
              type="file"
              accept=".json"
              className={styles.hiddenInput}
              onChange={handleJsonUpload}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => uploadInputRef.current?.click()}
            >
              ↑ Pre-fill from JSON
            </button>
            <button
              type="button"
              className={styles.helpBtn}
              onClick={() => setUploadHelpOpen(o => !o)}
              aria-expanded={uploadHelpOpen}
              aria-label="Help for pre-fill from JSON"
            >ⓘ</button>
            <span className={styles.uploadHint}>Populate fields from an existing metadata file</span>
          </div>
          {uploadHelpOpen && (
            <div className={styles.helpBlock}>
              Accepts any <code>.json</code> file that contains one or more of the following fields:
              <br /><br />
              <code>name</code>, <code>description</code>, <code>license</code>, <code>keywords</code>, <code>citation</code>, <code>url</code>, <code>funder</code>, <code>identifier</code>, <code>privacyPolicy</code>
              <br /><br />
              Array values (e.g. <code>"keywords": ["stroop", "rt"]</code>) are joined as comma-separated text. Unrecognized fields are ignored.
              <br /><br />
              Example:
              <pre className={styles.uploadHelpExample}>{`{
  "name": "my-stroop-experiment",
  "description": "Stroop task data from 40 participants.",
  "license": "CC-BY-4.0",
  "keywords": ["stroop", "reaction time"]
}`}</pre>
            </div>
          )}
        </div>

        {pendingUpload && (() => {
          const count = conflictFields.length;
          const fieldStr = count === 1
            ? `"${conflictFields[0]}"`
            : conflictFields.map(f => `"${f}"`).join(' and ');
          const msg = count === 1
            ? `The uploaded file has a different ${fieldStr} than what you've already entered.`
            : `The uploaded file has different values for ${fieldStr} than what you've already entered.`;
          return (
            <div className={styles.conflictCallout}>
              <div className={styles.conflictMsgRow}>
                <p className={styles.conflictMsg}>{msg}</p>
                <button
                  type="button"
                  className={styles.conflictToggle}
                  onClick={() => setConflictExpanded(e => !e)}
                  aria-expanded={conflictExpanded}
                >
                  {conflictExpanded ? 'Hide details ▲' : 'See details ▼'}
                </button>
              </div>
              {conflictExpanded && (
                <div className={styles.conflictDetails}>
                  {conflictFields.map(field => {
                    const original = field === 'name' ? session.name : session.description;
                    const uploaded = pendingUpload[field];
                    return (
                      <div key={field} className={styles.conflictDetail}>
                        {count > 1 && <p className={styles.conflictDetailField}>{field}</p>}
                        <div className={styles.conflictDetailRow}>
                          <span className={styles.conflictDetailLabel}>Current</span>
                          <span className={styles.conflictDetailValue}>{original}</span>
                        </div>
                        <div className={styles.conflictDetailRow}>
                          <span className={styles.conflictDetailLabel}>Uploaded</span>
                          <span className={styles.conflictDetailValue}>{uploaded}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.conflictBtns}>
                <button type="button" className={styles.conflictYes} onClick={() => applyUpload(pendingUpload, true)}>
                  Yes, overwrite
                </button>
                <button type="button" className={styles.conflictNo} onClick={() => applyUpload(pendingUpload, false)}>
                  No, keep mine
                </button>
              </div>
            </div>
          );
        })()}

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
              Description
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
          <p className={styles.hint}>Briefly describe your dataset. If left blank, defaults to "No description provided."</p>
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

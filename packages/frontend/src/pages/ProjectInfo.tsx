import { useState, useEffect, useRef } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import styles from './ProjectInfo.module.css';

export const OPTIONAL_FIELDS: { key: string; label: string; hint: string; help?: string; options?: readonly string[] }[] = [
  { key: 'license',    label: 'License',    hint: 'A standard license name like CC-BY-4.0, or a link to the license text', help: 'A license tells others what they may do with your data. Common choices for open research data: CC0 (public domain — no restrictions) and CC-BY-4.0 (free to use as long as you are credited). Enter the short name (e.g. CC-BY-4.0) or a link to the full text. If your institution has a data-sharing policy, check there first.' },
  { key: 'keywords',   label: 'Keywords',   hint: 'Terms that help people find this dataset, separated by commas (e.g. stroop, attention)' },
  { key: 'citation',   label: 'Citation',   hint: 'How you would like this dataset cited — a reference or a link' },
  { key: 'url',        label: 'URL',        hint: 'Where this dataset lives online (e.g. its OSF page)' },
  { key: 'funder',     label: 'Funder',     hint: 'Who funded the work — organization names, grant numbers, or both' },
  { key: 'identifier', label: 'Identifier', hint: 'A permanent ID for this dataset, such as a DOI' },
  { key: 'privacyPolicy', label: 'Sharing restrictions', hint: 'Who this dataset may be shared with. Saved as privacyPolicy.', options: ['', 'open', 'private', 'open_deidentified', 'open_redacted'],
    help: 'Pick the option that matches your IRB approval or data-sharing agreement:\n• open — can be shared publicly, as is\n• open_deidentified — can be shared once directly identifying information (names, dates of birth, and so on) is removed\n• open_redacted — can be shared once specific sensitive fields are removed\n• private — must not leave your team' },
];

export type MetadataLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type ProjectInfoSession = {
  name: string;
  description: string;
  optional: Record<string, string>;
  optionalOpen: boolean;
  /**
   * Outcome of loading an existing `dataset_description.json` into this session. Lives at the
   * AppShell level (via the session) so it survives page remounts and gates whether the Data
   * step is pre-completed and shown as "variables loaded from existing metadata" — a failed
   * parse must not look like a successful load.
   */
  loadStatus: MetadataLoadStatus;
  /**
   * Identity of the existing-metadata file this session was loaded from (name:size:lastModified),
   * or null if none. The load effect runs exactly once per file identity: on remount, a matching
   * token means the load already happened, so it is not re-run (which would clobber session edits).
   */
  loadToken: string | null;
};

export const emptyProjectInfoSession = (): ProjectInfoSession => ({
  name: '',
  description: '',
  optional: Object.fromEntries(OPTIONAL_FIELDS.map(f => [f.key, ''])),
  optionalOpen: false,
  loadStatus: 'idle',
  loadToken: null,
});

/** Stable identity for an uploaded file, used to load its metadata exactly once. */
const fileIdentity = (file: File): string => `${file.name}:${file.size}:${file.lastModified}`;

/**
 * Writes the project-info fields (name, description, optional) into the metadata instance —
 * shared by Continue and by the data-replace reset, which reloads existing metadata and then
 * re-applies the user's edited fields on top.
 */
export function applyProjectInfoFields(meta: JsPsychMetadata, session: ProjectInfoSession): void {
  meta.setMetadataField('name', session.name.trim());
  meta.setMetadataField('description', session.description.trim() || 'No description provided.');
  for (const { key } of OPTIONAL_FIELDS) {
    const val = (session.optional[key] ?? '').trim();
    if (val) {
      meta.setMetadataField(key, val);
    } else {
      meta.deleteMetadataField(key);
    }
  }
}

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
  const fileToken = existingMetadataFile ? fileIdentity(existingMetadataFile) : null;
  // Has this exact file already been loaded (or attempted) into the session? If so, don't reload
  // on remount — that would clobber edits the user made on other steps.
  const alreadyAttempted = fileToken !== null && session.loadToken === fileToken;

  const [loadStatus, setLoadStatus] = useState<MetadataLoadStatus>(
    alreadyAttempted ? session.loadStatus : existingMetadataFile ? 'loading' : 'idle',
  );
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<Record<string, string> | null>(null);
  const [conflictFields, setConflictFields] = useState<string[]>([]);
  const [conflictExpanded, setConflictExpanded] = useState(false);
  const [uploadHelpOpen, setUploadHelpOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const toggleHelp = (key: string) => setHelpOpen(prev => prev === key ? null : key);

  useEffect(() => {
    if (!existingMetadataFile || fileToken === null) return;
    // Load the existing metadata exactly once per uploaded file. A matching token means this file
    // was already loaded into the session on an earlier mount; re-running loadMetadata would
    // resurrect deleted authors / revert edited variables and clobber the form session.
    if (session.loadToken === fileToken) return;
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
          loadStatus: 'loaded',
          loadToken: fileToken,
        });
        setLoadStatus('loaded');
      } catch {
        setLoadStatus('error');
        setError("We couldn't read that metadata file. Check that it is valid JSON, then try again.");
        // Record the attempt (so it isn't retried) and propagate the failure so the Data step
        // isn't pre-completed or shown as "variables loaded from existing metadata".
        onSessionChange({ ...session, loadStatus: 'error', loadToken: fileToken });
      }
    };
    reader.onerror = () => {
      setLoadStatus('error');
      setError("We couldn't read that file. Try choosing it again.");
      onSessionChange({ ...session, loadStatus: 'error', loadToken: fileToken });
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
        setError("We couldn't read that JSON file. Check that it is valid JSON, then try again.");
      }
    };
    reader.readAsText(file);
  };

  const handleContinue = () => {
    if (!session.name.trim()) { setError('Enter a project name to continue.'); return; }
    setError('');
    applyProjectInfoFields(jsPsychMetadata, session);
    onComplete();
  };

  if (loadStatus === 'loading') {
    return <div className={styles.loading}>Loading existing metadata…</div>;
  }

  return (
    <>
      <h2 className="srOnly">Project Info</h2>
      <div className={styles.page}>
      <p className={styles.subtext}>Name your dataset and describe what it contains.</p>

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
            <span className={styles.uploadHint}>Fill these fields from a metadata file you already have</span>
          </div>
          {uploadHelpOpen && (
            <div className={styles.helpBlock}>
              Any <code>.json</code> file will do, as long as it contains one or more of these fields:
              <br /><br />
              <code>name</code>, <code>description</code>, <code>license</code>, <code>keywords</code>, <code>citation</code>, <code>url</code>, <code>funder</code>, <code>identifier</code>, <code>privacyPolicy</code>
              <br /><br />
              Lists (e.g. <code>"keywords": ["stroop", "rt"]</code>) become comma-separated text. Anything else in the file is ignored.
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
            ? `The file you uploaded has a different ${fieldStr} from the one you typed. Which would you like to keep?`
            : `The file you uploaded has different values for ${fieldStr} from the ones you typed. Which would you like to keep?`;
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
                  Use the uploaded values
                </button>
                <button type="button" className={styles.conflictNo} onClick={() => applyUpload(pendingUpload, false)}>
                  Keep what I typed
                </button>
              </div>
            </div>
          );
        })()}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="project-name">
            Project name <span className={styles.required}>*</span>
          </label>
          <p className={styles.hint}>Names your dataset and the folder you download. Any style works (e.g. StroopTask2024, my-stroop-experiment, stroop_study)</p>
          <input
            id="project-name"
            className={styles.input}
            type="text"
            value={session.name}
            onChange={e => set({ name: e.target.value })}
            placeholder="e.g. StroopTask2024"
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
          <p className={styles.hint}>Psych-DS requires a description, so leaving this blank records "No description provided."</p>
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

        {error && <p className={styles.error} role="alert">{error}</p>}

        <button className={styles.continueBtn} onClick={handleContinue}>
          Continue →
        </button>
      </div>
    </div>
    </>
  );
};

export default ProjectInfo;

import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import JsPsychMetadata, { analyzeJoinKeys } from '@jspsych/metadata';
import PageHeader from '../components/PageHeader';
import styles from './DataUpload.module.css';

type JoinKeyCandidate = { column: string; makesUnique: boolean };

export type FileStatus = {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'skipped' | 'error';
  detail?: string;
};

export type DataSession = {
  files: File[];
  fileTexts: Map<string, { content: string; type: string }>;
  joinKeyCandidates: JoinKeyCandidate[];
  joinKeyProblemFile: string;
  selectedKeys: string[];
  fileStatuses: FileStatus[];
};

export const emptyDataSession: DataSession = {
  files: [],
  fileTexts: new Map(),
  joinKeyCandidates: [],
  joinKeyProblemFile: '',
  selectedKeys: ['trial_index'],
  fileStatuses: [],
};

interface DataUploadProps {
  jsPsychMetadata: JsPsychMetadata;
  dataProcessed: boolean;
  existingMetadataLoaded?: boolean;
  onComplete: () => void;
  session: DataSession;
  onSessionChange: (s: DataSession) => void;
}

type Phase = 'hasData' | 'fromExisting' | 'idle' | 'ready' | 'preflight' | 'joinKeys' | 'processing' | 'done';

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });

const DataUpload: React.FC<DataUploadProps> = ({
  jsPsychMetadata,
  dataProcessed,
  existingMetadataLoaded,
  onComplete,
  session,
  onSessionChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const initialPhase: Phase = dataProcessed ? 'hasData' : existingMetadataLoaded ? 'fromExisting' : 'idle';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [files, setFiles] = useState<File[]>(session.files);
  const [sourceName, setSourceName] = useState('');
  const [pickError, setPickError] = useState('');
  const [fileTexts, setFileTexts] = useState(session.fileTexts);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>(session.fileStatuses);
  const [joinKeyCandidates, setJoinKeyCandidates] = useState<JoinKeyCandidate[]>(session.joinKeyCandidates);
  const [joinKeyProblemFile, setJoinKeyProblemFile] = useState(session.joinKeyProblemFile);
  const [committedKeys, setCommittedKeys] = useState<string[]>(session.selectedKeys);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(session.selectedKeys);
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const [joinKeyReturnPhase, setJoinKeyReturnPhase] = useState<Phase>('ready');
  const [showJoinKeyHelp, setShowJoinKeyHelp] = useState(false);

  // Keep parent session in sync
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  useEffect(() => {
    onSessionChangeRef.current({
      files, fileTexts, joinKeyCandidates, joinKeyProblemFile, selectedKeys: committedKeys, fileStatuses,
    });
  }, [files, fileTexts, joinKeyCandidates, joinKeyProblemFile, committedKeys, fileStatuses]);

  useEffect(() => {
    if (inputRef.current) (inputRef.current as any).webkitdirectory = true; // not in TS lib
  }, []);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const picked = [...e.target.files].filter(f => !f.name.startsWith('.'));
    const folderName = picked[0]?.webkitRelativePath.split('/')[0] ?? '';
    setFiles(picked);
    setSourceName(folderName);
    setPickError('');
    setPhase('ready');
    setFileStatuses([]);
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zipFile = e.target.files?.[0];
    if (!zipFile) return;
    setPickError('');
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const extracted: File[] = [];
      await Promise.all(
        Object.values(zip.files).map(async entry => {
          if (entry.dir) return;
          if (entry.name.startsWith('__MACOSX') || entry.name.split('/').pop()?.startsWith('.')) return;
          const text = await entry.async('text');
          extracted.push(new File([text], entry.name));
        })
      );
      if (extracted.length === 0) {
        setPickError('No readable files found in the zip archive.');
        return;
      }
      setFiles(extracted);
      setSourceName(zipFile.name.replace(/\.zip$/i, ''));
      setPhase('ready');
      setFileStatuses([]);
    } catch {
      setPickError('Could not read the zip file — make sure it is a valid .zip archive.');
    }
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const handleProcess = async () => {
    setPhase('preflight');

    const textMap = new Map<string, { content: string; type: string }>();
    for (const file of files) {
      const type = file.name.split('.').pop()?.toLowerCase() || '';
      const content = await readFileAsText(file);
      textMap.set(file.webkitRelativePath || file.name, { content, type });
    }
    setFileTexts(textMap);

    // Pre-flight: check join key uniqueness. Only JSON files are checked because
    // analyzeJoinKeys expects a parsed array of objects; CSV parsing would require
    // an extra parse step and CSV experiments are typically single-participant files
    // where trial_index is already unique.
    for (const [name, { content, type }] of textMap) {
      if (type !== 'json') continue;
      if (name === 'dataset_description.json' || name.endsWith('/dataset_description.json')) continue;
      try {
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed) || parsed.length === 0) continue;
        const analysis = analyzeJoinKeys(parsed, ['trial_index']);
        if (!analysis.isUnique) {
          setJoinKeyProblemFile(name);
          setJoinKeyCandidates(analysis.candidates);
          setJoinKeyReturnPhase('ready');
          setPhase('joinKeys');
          return;
        }
      } catch {
        continue;
      }
    }

    await runGenerate(textMap, ['trial_index'], true);
  };

  const handleJoinKeyApply = async () => {
    const keys = proceedAnyway ? ['trial_index'] : selectedKeys;
    setCommittedKeys(keys);
    await runGenerate(fileTexts, keys, proceedAnyway);
  };

  const toggleKey = (col: string) => {
    setSelectedKeys(prev =>
      prev.includes(col) ? prev.filter(k => k !== col) : [...prev, col]
    );
  };

  const runGenerate = async (
    textMap: Map<string, { content: string; type: string }>,
    joinKeys: string[],
    suppressWarning: boolean
  ) => {
    setPhase('processing');
    const initial: FileStatus[] = files.map(f => ({ name: f.name, status: 'pending' }));
    setFileStatuses(initial);

    const update = (i: number, patch: Partial<FileStatus>) =>
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const entry = textMap.get(file.webkitRelativePath || file.name);
      if (!entry) continue;
      const { content, type } = entry;

      update(i, { status: 'loading' });

      const filePath = file.webkitRelativePath || file.name;
      if (filePath === 'dataset_description.json' || filePath.endsWith('/dataset_description.json')) {
        update(i, { status: 'skipped', detail: 'existing metadata file' });
        continue;
      }

      if (type !== 'json' && type !== 'csv') {
        update(i, { status: 'skipped', detail: 'unsupported file type' });
        continue;
      }

      try {
        await jsPsychMetadata.generate(content, {}, type as 'json' | 'csv', {
          arrayJoinKeys: joinKeys,
          suppressJoinKeyWarning: suppressWarning,
        });
        update(i, { status: 'success' });
      } catch (e) {
        update(i, { status: 'error', detail: String(e) });
      }
    }

    setPhase('done');
  };

  const statusIcon = (s: FileStatus['status']) => {
    if (s === 'success')  return <span className={styles.iconSuccess}>✓</span>;
    if (s === 'error')    return <span className={styles.iconError}>✗</span>;
    if (s === 'skipped')  return <span className={styles.iconSkipped}>—</span>;
    if (s === 'loading')  return <span className={styles.iconLoading}>○</span>;
    return <span className={styles.iconPending}>·</span>;
  };

  // Drop into join key chooser, preserving the previously chosen keys
  const enterReConfigureJoinKeys = (returnTo: Phase) => {
    setProceedAnyway(false);
    setJoinKeyReturnPhase(returnTo);
    setPhase('joinKeys');
  };

  // Existing-project flow: variables already loaded from JSON, data upload is optional
  if (phase === 'fromExisting') {
    return (
      <>
        <PageHeader title="Data" />
        <div className={styles.page}>
        <div className={styles.hasDataBanner}>
          <span className={styles.iconSuccess}>✓</span>
          <div>
            <strong>Variables loaded from existing metadata</strong>
            <p className={styles.hasDataSub}>
              All variable descriptions, types, and levels were loaded from your{' '}
              <code>dataset_description.json</code>. No data upload is needed.
            </p>
          </div>
        </div>
        <p className={styles.fromExistingOptional}>
          Optionally, upload your data folder to add new variables or refresh levels and ranges.
        </p>
        <div className={styles.pickerRow}>
          <button className={styles.browseBtn} onClick={() => inputRef.current?.click()}>
            Upload data folder (optional)
          </button>
          <span className={styles.pickerOr}>or</span>
          <button className={styles.browseBtn} onClick={() => zipInputRef.current?.click()}>
            Upload .zip (optional)
          </button>
        </div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFolderChange} />
        <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleZipChange} />
        <div className={styles.doneActions}>
          <button className={styles.continueBtn} onClick={onComplete}>
            Continue →
          </button>
        </div>
      </div>
      </>
    );
  }

  // Already-processed summary shown when navigating back to this step
  if (phase === 'hasData') {
    const varCount = jsPsychMetadata.getVariableNames().length;
    return (
      <>
        <PageHeader title="Data" />
        <div className={styles.page}>
        <div className={styles.hasDataBanner}>
          <span className={styles.iconSuccess}>✓</span>
          <div>
            <strong>Data already processed</strong>
            <p className={styles.hasDataSub}>
              {varCount} variable{varCount !== 1 ? 's' : ''} generated.
            </p>
          </div>
        </div>

        {fileStatuses.length > 0 && (
          <ul className={styles.statusList}>
            {fileStatuses.map((s, i) => (
              <li key={i} className={styles.statusItem}>
                {statusIcon(s.status)}
                <span className={styles.statusName}>{s.name}</span>
                {s.detail && <span className={styles.statusDetail}>{s.detail}</span>}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.doneActions}>
          <button className={styles.continueBtn} onClick={onComplete}>
            Continue →
          </button>
          {joinKeyCandidates.length > 0 && fileTexts.size > 0 && (
            <button className={styles.reConfigureBtn} onClick={() => enterReConfigureJoinKeys('hasData')}>
              Re-configure join keys
            </button>
          )}
        </div>

        <div className={styles.additionalDivider}>Upload additional files</div>
        <div className={styles.pickerRow}>
          <button className={styles.browseBtn} onClick={() => inputRef.current?.click()}>
            Choose folder
          </button>
          <span className={styles.pickerOr}>or</span>
          <button className={styles.browseBtn} onClick={() => zipInputRef.current?.click()}>
            Upload .zip
          </button>
        </div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFolderChange} />
        <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleZipChange} />
      </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Data" />
      <div className={styles.page}>
      <p className={styles.description}>
        Select your data folder or upload a .zip archive. CSV and JSON files will be processed; other file types are skipped.
      </p>

      {/* Pickers */}
      <div className={styles.pickerRow}>
        <button className={styles.browseBtn} onClick={() => inputRef.current?.click()}>
          {files.length > 0 ? 'Change folder' : 'Choose folder'}
        </button>
        <span className={styles.pickerOr}>or</span>
        <button className={styles.browseBtn} onClick={() => zipInputRef.current?.click()}>
          Upload .zip
        </button>
        {files.length > 0 && sourceName && (
          <span className={styles.folderName}>
            {sourceName} ({files.length} file{files.length !== 1 ? 's' : ''})
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFolderChange}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleZipChange}
        />
      </div>
      {pickError && <p className={styles.pickError}>{pickError}</p>}

      {/* File list (before processing) */}
      {phase === 'ready' && (
        <>
          <ul className={styles.fileList}>
            {files.map(f => (
              <li key={f.webkitRelativePath || f.name} className={styles.fileItem}>
                <span className={styles.iconPending}>·</span>
                <span>{f.webkitRelativePath || f.name}</span>
              </li>
            ))}
          </ul>
          <button className={styles.processBtn} onClick={handleProcess}>
            Process files
          </button>
        </>
      )}

      {/* Pre-flight spinner */}
      {phase === 'preflight' && (
        <p className={styles.preflight}>Reading files…</p>
      )}

      {/* Join key chooser */}
      {phase === 'joinKeys' && (
        <div className={styles.joinKeySection}>
          <div className={styles.joinKeyWarning}>
            <span className={styles.warnIcon}>⚠</span>
            <div>
              <strong>Rows need a unique identifier</strong>
              <p className={styles.joinKeyFile}>{joinKeyProblemFile}</p>
              <p className={styles.joinKeyExplainer}>
                <code>trial_index</code> resets to 0 for each participant in merged files, so it
                can't tell rows apart on its own. Pick an additional column below to make each row unique.
              </p>
            </div>
          </div>

          <button
            className={styles.helpToggle}
            onClick={() => setShowJoinKeyHelp(p => !p)}
            aria-expanded={showJoinKeyHelp}
          >
            What is a join key? {showJoinKeyHelp ? '▲' : '▼'}
          </button>
          {showJoinKeyHelp && (
            <div className={styles.helpText}>
              <p>
                jsPsych experiments sometimes produce <strong>nested data</strong> — for example,
                a survey trial might contain multiple responses stored as an array inside a single row.
                To save this as a flat table (CSV), each nested item needs to be matched back to
                its parent row.
              </p>
              <p>
                A <strong>join key</strong> is a column (or combination of columns) whose values
                are unique for every row, so that nested items can be correctly linked.{' '}
                <code>trial_index</code> works fine in single-participant files, but if you merged
                data from multiple participants, each participant resets <code>trial_index</code>{' '}
                to 0 — making it non-unique. Adding a column like <code>subject</code> restores
                uniqueness.
              </p>
            </div>
          )}

          <ul className={styles.candidateList}>
            <li className={styles.candidateItem}>
              <input type="checkbox" checked disabled onChange={() => {}} />
              <span>trial_index</span>
              <span className={styles.candidateTag}>default</span>
            </li>
            {joinKeyCandidates.map(({ column, makesUnique }) => (
              <li key={column} className={styles.candidateItem}>
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(column)}
                  disabled={proceedAnyway}
                  onChange={() => toggleKey(column)}
                />
                <span>{column}</span>
                {makesUnique && <span className={styles.candidateTag}>sufficient alone</span>}
              </li>
            ))}
            <li className={styles.candidateItem}>
              <input
                type="checkbox"
                checked={proceedAnyway}
                onChange={() => { setProceedAnyway(p => !p); setSelectedKeys(['trial_index']); }}
              />
              <span className={styles.proceedLabel}>
                Proceed anyway — extracted CSVs may have duplicate rows
              </span>
            </li>
          </ul>

          <div className={styles.joinKeyActions}>
            <button className={styles.processBtn} onClick={handleJoinKeyApply}>
              Apply and process files
            </button>
            <button className={styles.cancelBtn} onClick={() => { setSelectedKeys(committedKeys); setProceedAnyway(false); setPhase(joinKeyReturnPhase); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Per-file status (processing + done) */}
      {(phase === 'processing' || phase === 'done') && (
        <ul className={styles.statusList}>
          {fileStatuses.map((s, i) => (
            <li key={i} className={styles.statusItem}>
              {statusIcon(s.status)}
              <span className={styles.statusName}>{s.name}</span>
              {s.detail && <span className={styles.statusDetail}>{s.detail}</span>}
            </li>
          ))}
        </ul>
      )}

      {phase === 'done' && (
        <div className={styles.doneActions}>
          <button className={styles.continueBtn} onClick={onComplete}>
            Continue →
          </button>
          {joinKeyCandidates.length > 0 && (
            <button className={styles.reConfigureBtn} onClick={() => enterReConfigureJoinKeys('done')}>
              Re-configure join keys
            </button>
          )}
        </div>
      )}
    </div>
    </>
  );
};

export default DataUpload;

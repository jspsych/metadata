import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import JsPsychMetadata, { analyzeJoinKeys, deriveFallbackBase, buildPsychDSDataFiles, hasUnnamedColumns, isValidPsychDSDataFilename, parseCSVForWrite, parseJsonData, PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT } from '@jspsych/metadata';
import PageHeader from '../components/PageHeader';
import { createStagedFileStore, type StagedFileStore } from '../staging/stagedFileStore';
import styles from './DataUpload.module.css';

type JoinKeyCandidate = { column: string; makesUnique: boolean };

export type FileStatus = {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'skipped' | 'error';
  detail?: string;
};

export type DataSession = {
  files: File[];
  /**
   * Staged Psych-DS `data/` payload built from the uploaded files (dataset-relative paths such as
   * `data/subject-sub01_data.csv`, `data/raw/sub01.json`). JSON is converted to Psych-DS-named CSV
   * here so the validator and the downloadable zip both see compliant datafiles; without this,
   * JSON uploads validate as MISSING_DATAFILE. Backed by OPFS (on disk) so a large study isn't
   * held in the heap; null until the first processing run. See {@link StagedFileStore}.
   */
  convertedStore: StagedFileStore | null;
  joinKeyCandidates: JoinKeyCandidate[];
  joinKeyProblemFile: string;
  selectedKeys: string[];
  fileStatuses: FileStatus[];
};

export const emptyDataSession: DataSession = {
  files: [],
  convertedStore: null,
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

/**
 * Normalised data-file type for routing. `.jsonl` is treated as `json` (parseJsonData accepts
 * both a single array and one JSON value per line, so JSONL flows through the same path), and
 * everything else keeps its lowercased extension.
 */
const dataFileType = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ext === 'jsonl' ? 'json' : ext;
};

/** Filename without its extension (e.g. "sub01.json" → "sub01"). */
const fileStem = (name: string): string => name.replace(/\.[^./]+$/, '');

/**
 * The Psych-DS base (keyword-value sequence before "_data.csv") of an already-compliant
 * data filename, or null if the name isn't compliant. Lets us preserve a meaningful uploaded
 * name (e.g. "sub-01_task-stroop_data.csv" → base "sub-01_task-stroop") instead of flattening
 * it into a single subject-<stem> value, mirroring the CLI's non-rename path. JSON uploads are
 * never compliant data filenames, so they always fall through to deriveFallbackBase.
 */
export const compliantBase = (name: string): string | null => {
  const m = /^(.*)_data\.(csv|tsv)$/.exec(name);
  return m && isValidPsychDSDataFilename(name) ? m[1] : null;
};

/**
 * Returns a name not already in `used`, appending a counter before the extension on collision
 * (e.g. "sub01.json" → "sub012.json"). Used for the flat data/raw/ directory, where originals
 * from different source folders can share a name.
 */
const disambiguateFlatFilename = (name: string, used: Set<string>): string => {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? '' : name.slice(dot);
  let n = 2;
  while (used.has(`${stem}${n}${ext}`)) n += 1;
  return `${stem}${n}${ext}`;
};

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
  const [convertedStore, setConvertedStore] = useState<StagedFileStore | null>(session.convertedStore);
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
      files, convertedStore, joinKeyCandidates, joinKeyProblemFile, selectedKeys: committedKeys, fileStatuses,
    });
  }, [files, convertedStore, joinKeyCandidates, joinKeyProblemFile, committedKeys, fileStatuses]);

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

    // Pre-flight: check join key uniqueness. Only JSON files are checked because
    // analyzeJoinKeys expects a parsed array of objects; CSV parsing would require
    // an extra parse step and CSV experiments are typically single-participant files
    // where trial_index is already unique.
    //
    // Each file is read on demand and dropped when the iteration ends, so the whole
    // upload is never resident in the heap at once (File objects are already disk-backed
    // by the browser). The trade-off is that JSON files are read again in runGenerate —
    // intentional: this step bounds peak memory, not total I/O.
    for (const file of files) {
      const name = file.webkitRelativePath || file.name;
      if (dataFileType(file.name) !== 'json') continue;
      if (name === 'dataset_description.json' || name.endsWith('/dataset_description.json')) continue;
      let content: string;
      try {
        content = await readFileAsText(file);
      } catch {
        // A read failure here only skips this file's join-key prompt; runGenerate reads it
        // again and surfaces the failure as a per-file 'error' status, so we never silently
        // emit duplicate rows. Hence skip quietly rather than mirroring that error handling.
        continue;
      }
      try {
        // Tag a per-line source_record_id for JSON-Lines (a no-op for a single array).
        const parsed = parseJsonData(content, { tagSourceRecordId: true });
        if (!Array.isArray(parsed) || parsed.length === 0) continue;
        // Mirror generate()'s join-key promotion so a multi-record JSON-Lines file isn't wrongly
        // flagged: trial_index alone repeats across records, but the identifier column (a
        // synthesized source_record_id, else a real participant_id) makes (id, trial_index) unique.
        const idColumn = (['source_record_id', 'participant_id'] as const).find((col) =>
          parsed.some((row: any) => row && typeof row === 'object' && col in row));
        const keys = idColumn ? [idColumn, 'trial_index'] : ['trial_index'];
        const analysis = analyzeJoinKeys(parsed, keys);
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

    await runGenerate(['trial_index'], true);
  };

  const handleJoinKeyApply = async () => {
    const keys = proceedAnyway ? ['trial_index'] : selectedKeys;
    setCommittedKeys(keys);
    await runGenerate(keys, proceedAnyway);
  };

  const toggleKey = (col: string) => {
    setSelectedKeys(prev =>
      prev.includes(col) ? prev.filter(k => k !== col) : [...prev, col]
    );
  };

  const runGenerate = async (
    joinKeys: string[],
    suppressWarning: boolean
  ) => {
    setPhase('processing');
    const initial: FileStatus[] = files.map(f => ({ name: f.name, status: 'pending' }));
    setFileStatuses(initial);

    const update = (i: number, patch: Partial<FileStatus>) =>
      setFileStatuses(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

    // Psych-DS `data/` payload built alongside metadata generation, staged to disk (OPFS) as each
    // file is produced so the whole study is never resident in the heap at once. The name sets are
    // shared across all files so converted CSVs are disambiguated against the whole output
    // directory (mirrors the CLI's processDirectory), and `data/raw/` is flat so originals too.
    // Reuse the existing store across re-processing runs, clearing stale output first.
    const store = convertedStore ?? createStagedFileStore();
    await store.clear();
    const usedArrayFilenames = new Set<string>();
    const usedRawFilenames = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      update(i, { status: 'loading' });

      const filePath = file.webkitRelativePath || file.name;
      if (filePath === 'dataset_description.json' || filePath.endsWith('/dataset_description.json')) {
        update(i, { status: 'skipped', detail: 'existing metadata file' });
        continue;
      }

      const type = dataFileType(file.name);
      if (type !== 'json' && type !== 'csv') {
        update(i, { status: 'skipped', detail: 'unsupported file type' });
        continue;
      }

      // Read this file's text on demand; it goes out of scope at the end of the iteration,
      // so peak heap is bounded to one file's working set rather than the whole upload.
      let content: string;
      try {
        content = await readFileAsText(file);
      } catch (e) {
        update(i, { status: 'error', detail: String(e) });
        continue;
      }

      try {
        // Parse the file once here and hand the rows to generate(), then reuse the same rows to
        // build the Psych-DS datafile(s) — so a large file isn't parsed twice. Conversion must
        // happen immediately: getExtracted* reflect only the most recent generate() call. JSON
        // arrays are serialised to CSV; CSV is written verbatim. Non-array JSON is skipped (it
        // isn't a jsPsych trial table) before generate() runs — matching the CLI.
        let mainRows: Array<Record<string, any>> = [];
        let mainContent: string | undefined;
        if (type === 'json') {
          // Tag a per-line source_record_id for JSON-Lines (a no-op for a single array) so the
          // main CSV carries the same join-key column generate() promotes for the sidecars.
          const stats: { synthesizedSourceRecordId?: boolean } = {};
          const json = parseJsonData(content, { tagSourceRecordId: true }, stats);
          if (!Array.isArray(json)) {
            update(i, { status: 'skipped', detail: 'not a jsPsych trial array' });
            continue;
          }
          mainRows = json;
          await jsPsychMetadata.generate(mainRows, {}, 'json', {
            arrayJoinKeys: joinKeys,
            suppressJoinKeyWarning: suppressWarning,
            synthesizedSourceRecordId: stats.synthesizedSourceRecordId === true,
          });
        } else {
          // Parse CSV rows so the builder can drop R-style unnamed row-index columns. A clean CSV
          // keeps its exact bytes (mainContent verbatim); record that eligibility before generate()
          // strips mainRows in place, since the builder can no longer detect the drop afterwards.
          // verbatimSafe is false for a CSV that only parsed thanks to quote relaxation (e.g. jsPsych
          // stimulus HTML with unescaped quotes) — written verbatim it would fail the validator's
          // strict CSV parse, so re-serialise it instead.
          const parsed = await parseCSVForWrite(content);
          mainRows = parsed.rows;
          const csvVerbatimEligible = parsed.verbatimSafe && !hasUnnamedColumns(mainRows);
          await jsPsychMetadata.generate(mainRows, {}, 'csv', {
            arrayJoinKeys: joinKeys,
            suppressJoinKeyWarning: suppressWarning,
          });
          if (csvVerbatimEligible) mainContent = content;
        }

        const built = buildPsychDSDataFiles({
          // Preserve an already-compliant uploaded CSV name; otherwise derive a subject-<stem> base.
          base: compliantBase(file.name) ?? deriveFallbackBase(fileStem(file.name)),
          mainRows,
          mainContent,
          extractedArrays: jsPsychMetadata.getExtractedArrays(),
          extractedObjects: jsPsychMetadata.getExtractedObjects(),
          joinKeys: jsPsychMetadata.getArrayJoinKeys(),
          usedArrayFilenames,
        });
        for (const f of built) await store.write(`data/${f.filename}`, f.content);

        // Preserve the original JSON under data/raw/ (CSV inputs are already tabular).
        if (type === 'json') {
          const rawName = disambiguateFlatFilename(file.name, usedRawFilenames);
          usedRawFilenames.add(rawName);
          await store.write(`data/raw/${rawName}`, content);
        }

        update(i, { status: 'success' });
      } catch (e) {
        update(i, { status: 'error', detail: String(e) });
      }
    }

    // When we preserved raw originals, tell the validator to skip data/raw/ so they don't
    // surface as FILE_NOT_CHECKED (shared definition with the CLI in @jspsych/metadata).
    if (usedRawFilenames.size > 0) {
      await store.write(PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT);
    }

    setConvertedStore(store);
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
          {joinKeyCandidates.length > 0 && files.length > 0 && (
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
                can't tell rows apart on its own. Pick an additional column below to form a{' '}
                <strong>join key</strong> — a unique row identifier.
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

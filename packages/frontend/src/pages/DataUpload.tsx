import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import JsPsychMetadata, { analyzeJoinKeys, deriveFallbackBase, buildPsychDSDataFiles, hasUnnamedColumns, isValidPsychDSDataFilename, parseCSVForWrite, parseJsonData, PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT } from '@jspsych/metadata';
import { createStagedFileStore, type StagedFileStore } from '../staging/stagedFileStore';
import { SAMPLE_DATASETS } from '../samples';
import styles from './DataUpload.module.css';

type JoinKeyCandidate = { column: string; makesUnique: boolean };

export type FileStatus = {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'skipped' | 'error';
  detail?: string;
};

export type DataSession = {
  /** Every uploaded file processed into the current staged payload, accumulated across batches. */
  files: File[];
  /** Display name of the last picked folder/zip (component-local state moved here so it survives remounts). */
  sourceName: string;
  /**
   * Staged Psych-DS `data/` payload built from the uploaded files (dataset-relative paths such as
   * `data/subject-sub01_data.csv`, `data/raw/sub01.json`). JSON is converted to Psych-DS-named CSV
   * here so the validator and the downloadable zip both see compliant datafiles; without this,
   * JSON uploads validate as MISSING_DATAFILE. Backed by OPFS (on disk) so a large study isn't
   * held in the heap; null until the first processing run. See {@link StagedFileStore}.
   */
  convertedStore: StagedFileStore | null;
  /**
   * Filenames already used for converted CSVs / preserved raw originals in the staged store.
   * Persisted so a later additive batch disambiguates against the whole output directory (not just
   * its own files), keeping the staged data and the metadata's variableMeasured in agreement.
   */
  usedArrayFilenames: string[];
  usedRawFilenames: string[];
  joinKeyCandidates: JoinKeyCandidate[];
  joinKeyProblemFile: string;
  selectedKeys: string[];
  fileStatuses: FileStatus[];
};

export const emptyDataSession: DataSession = {
  files: [],
  sourceName: '',
  convertedStore: null,
  usedArrayFilenames: [],
  usedRawFilenames: [],
  joinKeyCandidates: [],
  joinKeyProblemFile: '',
  selectedKeys: ['trial_index'],
  fileStatuses: [],
};

interface DataUploadProps {
  jsPsychMetadata: JsPsychMetadata;
  dataProcessed: boolean;
  existingMetadataLoaded?: boolean;
  /** Allowlisted sample slug to auto-fetch and process on mount (docs deep link); undefined normally. */
  sampleSlug?: string;
  onComplete: () => void;
  /**
   * Full data reset for the "replace all data" flow: clears generated variables so metadata stops
   * describing the discarded dataset (see AppShell). Called before staging a replacement batch.
   */
  onResetMetadata?: () => void | Promise<void>;
  /** Reports whether a run is in flight so the shell can lock navigation while processing. */
  onBusyChange?: (busy: boolean) => void;
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

/**
 * The readable part of a thrown value, for the per-file status list. `String(err)` on an Error
 * yields "Error: …", and that prefix is noise to someone scanning which of their files failed.
 */
const errorDetail = (e: unknown): string => (e instanceof Error ? e.message : String(e));

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

/** Confirmation shown before a destructive "replace all data" — clears staged data and metadata. */
const ReplaceConfirm: React.FC<{ onConfirm: () => void; onCancel: () => void }> = ({ onConfirm, onCancel }) => (
  <div className={styles.replaceConfirm} role="alertdialog" aria-labelledby="replace-confirm-title">
    <p id="replace-confirm-title" className={styles.replaceConfirmMsg}>
      Replace all uploaded data? This throws away the files you've uploaded and every variable found
      in them, then lets you pick a new folder or .zip. Your own files on disk are not touched.
    </p>
    <div className={styles.replaceConfirmBtns}>
      <button className={styles.replaceConfirmYes} onClick={onConfirm}>Yes, replace</button>
      <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
    </div>
  </div>
);

const DataUpload: React.FC<DataUploadProps> = ({
  jsPsychMetadata,
  dataProcessed,
  existingMetadataLoaded,
  sampleSlug,
  onComplete,
  onResetMetadata,
  onBusyChange,
  session,
  onSessionChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Restore 'ready' when files were picked but never processed, so a navigation round-trip doesn't
  // silently drop the selection (files live in the session, which survives the page remount).
  const initialPhase: Phase = dataProcessed
    ? 'hasData'
    : session.files.length > 0
      ? 'ready'
      : existingMetadataLoaded
        ? 'fromExisting'
        : 'idle';
  const [phase, setPhase] = useState<Phase>(initialPhase);
  // `files` is the accumulated set backing the session; `batch` is the not-yet-processed pick that
  // the ready list shows and runGenerate processes. On mount both start from the session so an
  // unprocessed selection reappears.
  const [files, setFiles] = useState<File[]>(session.files);
  const [batch, setBatch] = useState<File[]>(session.files);
  const [sourceName, setSourceName] = useState(session.sourceName);
  const [pickError, setPickError] = useState('');
  const [convertedStore, setConvertedStore] = useState<StagedFileStore | null>(session.convertedStore);
  const [usedArrayFilenames, setUsedArrayFilenames] = useState<string[]>(session.usedArrayFilenames);
  const [usedRawFilenames, setUsedRawFilenames] = useState<string[]>(session.usedRawFilenames);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>(session.fileStatuses);
  const [joinKeyCandidates, setJoinKeyCandidates] = useState<JoinKeyCandidate[]>(session.joinKeyCandidates);
  const [joinKeyProblemFile, setJoinKeyProblemFile] = useState(session.joinKeyProblemFile);
  const [committedKeys, setCommittedKeys] = useState<string[]>(session.selectedKeys);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(session.selectedKeys);
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const [joinKeyReturnPhase, setJoinKeyReturnPhase] = useState<Phase>('ready');
  const [showJoinKeyHelp, setShowJoinKeyHelp] = useState(false);
  // 'additive' appends the next batch to the existing staged data + metadata; 'replace' starts the
  // data over (after a confirm + full reset). Set when the user picks a folder/zip.
  const [pendingMode, setPendingMode] = useState<'replace' | 'additive'>('replace');
  // Which picker to open once the user confirms a destructive replace, or null when no confirm is pending.
  const [replaceConfirm, setReplaceConfirm] = useState<null | 'folder' | 'zip'>(null);

  // Keep parent session in sync
  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;
  useEffect(() => {
    onSessionChangeRef.current({
      files, sourceName, convertedStore, usedArrayFilenames, usedRawFilenames,
      joinKeyCandidates, joinKeyProblemFile, selectedKeys: committedKeys, fileStatuses,
    });
  }, [files, sourceName, convertedStore, usedArrayFilenames, usedRawFilenames, joinKeyCandidates, joinKeyProblemFile, committedKeys, fileStatuses]);

  // Report processing state so the shell can lock navigation while a run is in flight — otherwise
  // navigating away mid-run orphans the staged data and loses the partially-generated variables.
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => {
    onBusyChangeRef.current?.(phase === 'preflight' || phase === 'processing');
  }, [phase]);

  /** Whether a prior run already staged data (so replacing it needs a confirm + reset). */
  const hasStagedData = (): boolean => (convertedStore?.paths().length ?? 0) > 0;

  // Open a picker. A destructive replace over already-staged data asks for confirmation first;
  // everything else (first pick, additional files) opens immediately.
  const requestPick = (kind: 'folder' | 'zip', mode: 'replace' | 'additive') => {
    setPickError('');
    if (mode === 'replace' && hasStagedData()) {
      setReplaceConfirm(kind);
      return;
    }
    setPendingMode(mode);
    (kind === 'folder' ? inputRef : zipInputRef).current?.click();
  };

  // Confirmed replace: wipe the staged data and reset the metadata variables so both start empty,
  // then open the chosen picker to stage the replacement (as a fresh, non-additive run).
  const confirmReplace = async () => {
    const kind = replaceConfirm;
    setReplaceConfirm(null);
    await onResetMetadata?.();
    await convertedStore?.clear();
    setConvertedStore(null);
    setFiles([]);
    setBatch([]);
    setFileStatuses([]);
    setUsedArrayFilenames([]);
    setUsedRawFilenames([]);
    setJoinKeyCandidates([]);
    setJoinKeyProblemFile('');
    setSourceName('');
    setPendingMode('replace');
    setPhase('idle');
    if (kind === 'folder') inputRef.current?.click();
    else if (kind === 'zip') zipInputRef.current?.click();
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) { return; }
    const picked = [...e.target.files].filter(f => !f.name.startsWith('.'));
    const folderName = picked[0]?.webkitRelativePath.split('/')[0] ?? '';
    // Reset the input value so re-picking the same folder fires change again.
    e.target.value = '';
    if (picked.length === 0) return;
    setBatch(picked);
    if (pendingMode === 'replace') setFiles(picked);
    setSourceName(folderName);
    setPickError('');
    setPhase('ready');
  };

  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const zipFile = e.target.files?.[0];
    // Reset input so the same file can be re-selected.
    e.target.value = '';
    if (!zipFile) return;
    setPickError('');
    try {
      const zip = await JSZip.loadAsync(zipFile);
      // Extract entries sequentially as Blobs (not concurrently as strings) so the whole archive
      // isn't inflated into the heap at once. Use the entry basename for the File name — the full
      // in-archive path defeats the Psych-DS compliant-name check and produces nested data/raw/
      // paths — while keeping the path on webkitRelativePath for display and disambiguation.
      const extracted: File[] = [];
      for (const entry of Object.values(zip.files)) {
        if (entry.dir) continue;
        const base = entry.name.split('/').pop() ?? entry.name;
        if (entry.name.startsWith('__MACOSX') || base.startsWith('.')) continue;
        const blob = await entry.async('blob');
        const file = new File([blob], base);
        Object.defineProperty(file, 'webkitRelativePath', { value: entry.name, configurable: true });
        extracted.push(file);
      }
      if (extracted.length === 0) {
        setPickError("That .zip doesn't contain any files we can read. Check that your data files are inside it, then try again.");
        return;
      }
      setBatch(extracted);
      if (pendingMode === 'replace') setFiles(extracted);
      setSourceName(zipFile.name.replace(/\.zip$/i, ''));
      setPhase('ready');
    } catch {
      setPickError("We couldn't open that file. Check that it is a valid .zip archive, then try again.");
    }
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
    for (const file of batch) {
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
          parsed.some((row) => row && typeof row === 'object' && col in row));
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
    suppressWarning: boolean,
    // Defaults to the picked `batch` state; the sample preload passes its freshly-fetched files
    // directly, since setBatch() hasn't flushed to state yet when it kicks off processing.
    targetBatch: File[] = batch
  ) => {
    setPhase('processing');
    // Additive runs append this batch's outcomes below the previous batches'; replace runs start
    // the status list (and the staged data) over.
    const additive = pendingMode === 'additive';
    const priorStatuses = additive ? fileStatuses : [];
    const offset = priorStatuses.length;
    const initial: FileStatus[] = targetBatch.map(f => ({ name: f.name, status: 'pending' }));
    setFileStatuses([...priorStatuses, ...initial]);

    const update = (i: number, patch: Partial<FileStatus>) =>
      setFileStatuses(prev => prev.map((s, idx) => idx === offset + i ? { ...s, ...patch } : s));

    // Psych-DS `data/` payload built alongside metadata generation, staged to disk (OPFS) as each
    // file is produced so the whole study is never resident in the heap at once. The name sets are
    // shared across all files so converted CSVs are disambiguated against the whole output
    // directory (mirrors the CLI's processDirectory), and `data/raw/` is flat so originals too.
    // An additive run keeps the existing staged files and seeds the name sets from the session so
    // the new batch is disambiguated against them; a replace run starts from an empty store.
    const store = convertedStore ?? createStagedFileStore();
    if (!additive) await store.clear();
    const arrayNames = new Set<string>(additive ? usedArrayFilenames : []);
    const rawNames = new Set<string>(additive ? usedRawFilenames : []);

    for (let i = 0; i < targetBatch.length; i++) {
      const file = targetBatch[i];

      update(i, { status: 'loading' });

      const filePath = file.webkitRelativePath || file.name;
      if (filePath === 'dataset_description.json' || filePath.endsWith('/dataset_description.json')) {
        update(i, { status: 'skipped', detail: 'this is a metadata file, not data' });
        continue;
      }

      const type = dataFileType(file.name);
      if (type !== 'json' && type !== 'csv') {
        update(i, { status: 'skipped', detail: 'not a .csv, .json, or .jsonl file' });
        continue;
      }

      // Read this file's text on demand; it goes out of scope at the end of the iteration,
      // so peak heap is bounded to one file's working set rather than the whole upload.
      let content: string;
      try {
        content = await readFileAsText(file);
      } catch (e) {
        update(i, { status: 'error', detail: errorDetail(e) });
        continue;
      }

      try {
        // Parse the file once here and hand the rows to generate(), then reuse the same rows to
        // build the Psych-DS datafile(s) — so a large file isn't parsed twice. Conversion must
        // happen immediately: getExtracted* reflect only the most recent generate() call. JSON
        // arrays are serialised to CSV; CSV is written verbatim. Non-array JSON is skipped (it
        // isn't a jsPsych trial table) before generate() runs — matching the CLI.
        let mainRows: Array<Record<string, unknown>> = [];
        let mainContent: string | undefined;
        // A clean CSV written verbatim under its own compliant name is the only input with no
        // separate "raw" form; everything else (JSON, a re-serialised CSV, or a renamed CSV) is
        // transformed and its original is preserved under data/raw/ below. Stays false for JSON.
        let csvVerbatimEligible = false;
        if (type === 'json') {
          // Tag a per-line source_record_id for JSON-Lines (a no-op for a single array) so the
          // main CSV carries the same join-key column generate() promotes for the sidecars.
          const stats: { synthesizedSourceRecordId?: boolean } = {};
          const json = parseJsonData(content, { tagSourceRecordId: true }, stats);
          if (!Array.isArray(json)) {
            update(i, { status: 'skipped', detail: "doesn't look like a jsPsych trial list" });
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
          csvVerbatimEligible = parsed.verbatimSafe && !hasUnnamedColumns(mainRows);
          if (!parsed.verbatimSafe) {
            console.warn(`"${file.name}" is not strictly valid CSV; it was parsed leniently and the staged copy is re-serialised as well-formed CSV.`);
          }
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
          usedArrayFilenames: arrayNames,
        });
        for (const f of built) await store.write(`data/${f.filename}`, f.content);

        // Preserve the untouched original under data/raw/ whenever the Psych-DS output is not a
        // verbatim, same-named copy of the input: JSON is always converted to CSV; a CSV is
        // transformed when it had to be re-serialised (csvVerbatimEligible === false) or when its
        // filename changed to a compliant name (mainName !== file.name). data/raw/ is flat, so
        // same-named originals from different source folders are disambiguated.
        const mainName = built.find(f => f.kind === 'main')?.filename;
        const transformed = type === 'json' || !csvVerbatimEligible || mainName !== file.name;
        if (transformed) {
          const rawName = disambiguateFlatFilename(file.name, rawNames);
          rawNames.add(rawName);
          await store.write(`data/raw/${rawName}`, content);
          // Tell the validator to skip data/raw/ so preserved originals don't surface as
          // FILE_NOT_CHECKED. Written inside the per-file try (guarded against re-writing) so an
          // OPFS failure is reported as this file's error instead of hanging the run in 'processing'.
          if (!store.has(PSYCHDS_IGNORE_FILENAME)) {
            await store.write(PSYCHDS_IGNORE_FILENAME, PSYCHDS_IGNORE_CONTENT);
          }
        }

        update(i, { status: 'success' });
      } catch (e) {
        update(i, { status: 'error', detail: errorDetail(e) });
      }
    }

    // Persist the accumulated name sets and staged store so a later additive batch stays consistent.
    setUsedArrayFilenames([...arrayNames]);
    setUsedRawFilenames([...rawNames]);
    setConvertedStore(store);
    setFiles(prev => (additive ? [...prev, ...targetBatch] : targetBatch));
    setPhase('done');
  };

  // One-shot sample preload: when the wizard is opened via a docs "try this sample" deep link,
  // fetch the bundled sample file(s), stage them as if the user had picked them, and run the normal
  // processing pipeline so the visitor lands on the generated data with no upload.
  useEffect(() => {
    // hasOwnProperty, not a bare index, so a prototype-chain slug (`__proto__`, `toString`) can't
    // masquerade as an allowlisted sample. App.tsx already validates, but this stays self-contained.
    if (!sampleSlug || !Object.prototype.hasOwnProperty.call(SAMPLE_DATASETS, sampleSlug)) return;
    const sample = SAMPLE_DATASETS[sampleSlug];

    // `cancelled` (rather than a persistent ref) gives one-shot behavior that survives StrictMode:
    // in dev React mounts, cleans up, then remounts, so the first run is cancelled by its cleanup
    // and the second runs to completion. `sampleSlug` is stable for the session, so the effect
    // never re-fires otherwise — no risk of processing twice.
    let cancelled = false;
    (async () => {
      setPhase('preflight');
      try {
        const fetched = await Promise.all(
          sample.files.map(async ({ url, name }) => {
            // Resolve against the running document: the wizard is served under
            // `<baseUrl>/wizard-app/`, so `../examples/…` reaches the docs `static/examples/`.
            const res = await fetch(new URL(url, document.baseURI));
            if (!res.ok) throw new Error(`${name} — HTTP ${res.status}`);
            return new File([await res.text()], name);
          })
        );
        if (cancelled) return;
        setBatch(fetched);
        setFiles(fetched);
        setSourceName(sample.label);
        // Bundled samples are single-participant, so trial_index is already unique — skip the
        // join-key pre-flight and process straight through the freshly-fetched batch.
        await runGenerate(['trial_index'], true, fetched);
      } catch (e) {
        if (cancelled) return;
        setPickError(
          `We couldn't load the ${sample.label} dataset. Check your internet connection and ` +
          `reload the page, or upload your own data instead. (${errorDetail(e)})`,
        );
        setPhase('idle');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleSlug]);

  const statusIcon = (s: FileStatus['status']) => {
    if (s === 'success')  return <span className={styles.iconSuccess}>✓</span>;
    if (s === 'error')    return <span className={styles.iconError}>✗</span>;
    if (s === 'skipped')  return <span className={styles.iconSkipped}>—</span>;
    if (s === 'loading')  return <span className={styles.iconLoading}>○</span>;
    return <span className={styles.iconPending}>·</span>;
  };

  // Drop into join key chooser, preserving the previously chosen keys. Re-configuring reprocesses
  // the whole accumulated dataset with the new keys as a fresh replace run (clears the store and
  // rebuilds it), so batch is reset to every uploaded file and the mode to 'replace' — otherwise an
  // additive re-run would double-stage the last batch.
  const enterReConfigureJoinKeys = (returnTo: Phase) => {
    setProceedAnyway(false);
    setBatch(files);
    setPendingMode('replace');
    setJoinKeyReturnPhase(returnTo);
    setPhase('joinKeys');
  };

  // Existing-project flow: variables already loaded from JSON, data upload is optional
  if (phase === 'fromExisting') {
    return (
      <>
        <h2 className="srOnly">Data</h2>
        <div className={styles.page}>
        <div className={styles.hasDataBanner}>
          <span className={styles.iconSuccess}>✓</span>
          <div>
            <strong>Variables loaded from existing metadata</strong>
            <p className={styles.hasDataSub}>
              Your <code>dataset_description.json</code> already describes every variable, so you
              can go straight on.
            </p>
          </div>
        </div>
        <p className={styles.fromExistingOptional}>
          Upload your data folder only if you want to pick up new variables, or refresh the recorded
          value ranges and levels after collecting more data.
        </p>
        <div className={styles.pickerRow}>
          <button className={styles.browseBtn} onClick={() => requestPick('folder', 'replace')}>
            Choose folder
          </button>
          <span className={styles.pickerOr}>or</span>
          <button className={styles.browseBtn} onClick={() => requestPick('zip', 'replace')}>
            Upload .zip
          </button>
        </div>
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFolderChange} {...{ webkitdirectory: '' }} />
        <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleZipChange} />
        {pickError && <p className={styles.pickError} role="alert">{pickError}</p>}
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
        <h2 className="srOnly">Data</h2>
        <div className={styles.page}>
        <div className={styles.hasDataBanner}>
          <span className={styles.iconSuccess}>✓</span>
          <div>
            <strong>Data already processed</strong>
            <p className={styles.hasDataSub}>
              {varCount} variable{varCount !== 1 ? 's' : ''} found in your data.
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
              Change join keys
            </button>
          )}
        </div>

        <div className={styles.additionalDivider}>Upload additional files</div>
        <div className={styles.pickerRow}>
          <button className={styles.browseBtn} onClick={() => requestPick('folder', 'additive')}>
            Choose folder
          </button>
          <span className={styles.pickerOr}>or</span>
          <button className={styles.browseBtn} onClick={() => requestPick('zip', 'additive')}>
            Upload .zip
          </button>
        </div>
        <p className={styles.additionalHint}>
          New files are added to your dataset.{' '}
          <button type="button" className={styles.replaceLink} onClick={() => requestPick('folder', 'replace')}>
            Replace all data instead
          </button>
        </p>
        {pickError && <p className={styles.pickError} role="alert">{pickError}</p>}
        <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFolderChange} {...{ webkitdirectory: '' }} />
        <input ref={zipInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={handleZipChange} />
        {replaceConfirm && (
          <ReplaceConfirm onConfirm={confirmReplace} onCancel={() => setReplaceConfirm(null)} />
        )}
      </div>
      </>
    );
  }

  return (
    <>
      <h2 className="srOnly">Data</h2>
      <div className={styles.page}>
      <p className={styles.description}>
        Choose the folder holding your data files, or upload a .zip. CSV, JSON, and JSON-Lines files are
        read; anything else is skipped. Your original files are never modified.
      </p>

      {/* Pickers */}
      <div className={styles.pickerRow}>
        <button className={styles.browseBtn} onClick={() => requestPick('folder', 'replace')}>
          {batch.length > 0 ? 'Change folder' : 'Choose folder'}
        </button>
        <span className={styles.pickerOr}>or</span>
        <button className={styles.browseBtn} onClick={() => requestPick('zip', 'replace')}>
          Upload .zip
        </button>
        {batch.length > 0 && sourceName && (
          <span className={styles.folderName}>
            {sourceName} ({batch.length} file{batch.length !== 1 ? 's' : ''})
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFolderChange}
          {...{ webkitdirectory: '' }}
        />
        <input
          ref={zipInputRef}
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleZipChange}
        />
      </div>
      {pickError && <p className={styles.pickError} role="alert">{pickError}</p>}

      {replaceConfirm && (
        <ReplaceConfirm onConfirm={confirmReplace} onCancel={() => setReplaceConfirm(null)} />
      )}

      {/* File list (before processing) */}
      {phase === 'ready' && (
        <>
          <ul className={styles.fileList}>
            {batch.map(f => (
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
        <p className={styles.preflight} aria-live="polite">Reading files…</p>
      )}

      {/* Join key chooser */}
      {phase === 'joinKeys' && (
        <div className={styles.joinKeySection}>
          <div className={styles.joinKeyWarning}>
            <span className={styles.warnIcon}>⚠</span>
            <div>
              <strong>This file needs a column that tells its rows apart</strong>
              <p className={styles.joinKeyFile}>{joinKeyProblemFile}</p>
              <p className={styles.joinKeyExplainer}>
                <code>trial_index</code> isn't unique here — usually because several participants
                were merged into one file, and it starts over at 0 for each of them. Tick another
                column below so that together they identify every row.
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
                Some jsPsych trials store a whole list inside one row — a survey trial holding
                several responses, for example. Psych-DS datasets are flat tables, so those lists
                get pulled out into their own CSV files, and every extracted row needs a way to
                point back to the trial it came from.
              </p>
              <p>
                A <strong>join key</strong> is the column, or combination of columns, that does
                this. Its values have to be different for every row.{' '}
                <code>trial_index</code> is enough on its own in a single-participant file. But
                once you merge several participants together it starts over at 0 for each of them,
                so it no longer identifies a row by itself — adding something like{' '}
                <code>subject</code> fixes that.
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
                Continue without one — the extracted files may contain duplicate rows
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
        <>
          <p className={styles.processSummary} aria-live="polite">
            {(() => {
              const total = fileStatuses.length;
              if (phase === 'processing') {
                const done = fileStatuses.filter(s => s.status !== 'pending' && s.status !== 'loading').length;
                return `Processing… ${done} of ${total} file${total !== 1 ? 's' : ''} done.`;
              }
              // Report the outcome, not just the count: "4 of 4 processed" reads as success even
              // when some of those four were skipped or failed.
              const count = (status: FileStatus['status']) =>
                fileStatuses.filter(s => s.status === status).length;
              const read = count('success');
              const parts = [`${read} file${read !== 1 ? 's' : ''} read`];
              if (count('skipped') > 0) parts.push(`${count('skipped')} skipped`);
              if (count('error') > 0) parts.push(`${count('error')} could not be read`);
              return `Finished. ${parts.join(', ')}.`;
            })()}
          </p>
          <ul className={styles.statusList}>
            {fileStatuses.map((s, i) => (
              <li key={i} className={styles.statusItem}>
                {statusIcon(s.status)}
                <span className={styles.statusName}>{s.name}</span>
                {s.detail && <span className={styles.statusDetail}>{s.detail}</span>}
              </li>
            ))}
          </ul>
        </>
      )}

      {phase === 'done' && (
        <div className={styles.doneActions}>
          <button className={styles.continueBtn} onClick={onComplete}>
            Continue →
          </button>
          {joinKeyCandidates.length > 0 && (
            <button className={styles.reConfigureBtn} onClick={() => enterReConfigureJoinKeys('done')}>
              Change join keys
            </button>
          )}
        </div>
      )}
    </div>
    </>
  );
};

export default DataUpload;

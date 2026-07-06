import { useState, useEffect, useRef, useCallback } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Sidebar from './Sidebar';
import PreviewDrawer from './PreviewDrawer';
import ProjectInfo, { ProjectInfoSession, emptyProjectInfoSession, applyProjectInfoFields } from '../pages/ProjectInfo';
import DataUpload, { DataSession, emptyDataSession } from '../pages/DataUpload';
import Variables from '../pages/Variables';
import Authors from '../pages/Authors';
import Review from '../pages/Review';
import styles from './AppShell.module.css';

export type StepId = 'projectInfo' | 'data' | 'variables' | 'authors' | 'review';

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'projectInfo', label: 'Project Info' },
  { id: 'data', label: 'Data' },
  { id: 'variables', label: 'Variables' },
  { id: 'authors', label: 'Authors' },
  { id: 'review', label: 'Review' },
];

interface AppShellProps {
  jsPsychMetadata: JsPsychMetadata;
  existingMetadataFile?: File;
  onStartOver: () => void;
}

const AppShell: React.FC<AppShellProps> = ({ jsPsychMetadata, existingMetadataFile, onStartOver }) => {
  const [currentStep, setCurrentStep] = useState<StepId>('projectInfo');
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(() => new Set<StepId>());
  const [dataProcessed, setDataProcessed] = useState(false);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataSession, setDataSession] = useState<DataSession>(emptyDataSession);
  const [projectInfoSession, setProjectInfoSession] = useState<ProjectInfoSession>(
    () => emptyProjectInfoSession()
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  // An existing project's Data step is only "done for free" once its metadata actually loaded —
  // a failed parse must not pre-complete Data or claim variables were loaded from it.
  const existingLoaded = projectInfoSession.loadStatus === 'loaded';

  // Pre-complete the Data step when an existing project's metadata loads successfully — its
  // variables come from the JSON, so no data upload is required to advance.
  useEffect(() => {
    if (existingLoaded) {
      setCompletedSteps(prev => (prev.has('data') ? prev : new Set([...prev, 'data'])));
    }
  }, [existingLoaded]);

  // Latest project-info fields, read when rebuilding metadata after a data replace.
  const projectInfoSessionRef = useRef(projectInfoSession);
  projectInfoSessionRef.current = projectInfoSession;

  // Full data reset for the "replace all data" flow: drop every generated variable so the
  // metadata no longer describes the discarded dataset, then (for an existing project) restore
  // the uploaded metadata file's variables and re-apply the user's edited project-info fields.
  const resetMetadata = useCallback(async () => {
    for (const name of jsPsychMetadata.getVariableNames()) jsPsychMetadata.deleteVariable(name);
    if (existingMetadataFile) {
      try {
        jsPsychMetadata.loadMetadata(await existingMetadataFile.text());
      } catch {
        /* leave the cleared state if the file no longer parses */
      }
      applyProjectInfoFields(jsPsychMetadata, projectInfoSessionRef.current);
    }
  }, [jsPsychMetadata, existingMetadataFile]);

  // Warn before an accidental tab close/reload while there's unsaved work (files staged or metadata
  // edited) that hasn't been downloaded yet — nothing is persisted server-side. Lifted once the
  // user downloads their dataset.
  const [downloaded, setDownloaded] = useState(false);
  const hasUnsavedWork =
    !downloaded &&
    (dataSession.files.length > 0 ||
      (dataSession.convertedStore?.paths().length ?? 0) > 0 ||
      projectInfoSession.name.trim() !== '' ||
      projectInfoSession.description.trim() !== '');
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsavedWork]);

  // Discard this session's on-disk staging before tearing the shell down — Start Over throws the
  // whole project away, so the converted CSVs/raw originals shouldn't linger in OPFS (otherwise
  // they sit there until the next startup sweep). Fire-and-forget: clear() swallows its own errors
  // and navigation needn't wait on disk cleanup.
  const handleStartOver = () => {
    void dataSession.convertedStore?.clear();
    onStartOver();
  };

  const completeStep = (stepId: StepId) => {
    const idx = STEPS.findIndex(s => s.id === stepId);
    setCompletedSteps(prev => new Set([...prev, stepId]));
    // Navigate to the first step after this one that hasn't been completed yet,
    // so pre-completed steps (e.g. Data when opening existing project) are skipped.
    const afterComplete = new Set([...completedSteps, stepId]);
    for (let i = idx + 1; i < STEPS.length; i++) {
      if (!afterComplete.has(STEPS[i].id)) {
        setCurrentStep(STEPS[i].id);
        return;
      }
    }
  };

  const canNavigateTo = (stepId: StepId): boolean => {
    const idx = STEPS.findIndex(s => s.id === stepId);
    if (idx === 0) return true;
    // Each step requires the preceding step to be complete. For existing projects, Data is
    // pre-completed so it appears unlocked — but it still requires ProjectInfo first because
    // ProjectInfo (idx=0) is the predecessor of Data (idx=1). The user must Continue through
    // ProjectInfo before Data or any later step becomes navigable.
    return completedSteps.has(STEPS[idx - 1].id);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'projectInfo':
        return (
          <ProjectInfo
            jsPsychMetadata={jsPsychMetadata}
            existingMetadataFile={existingMetadataFile}
            session={projectInfoSession}
            onSessionChange={setProjectInfoSession}
            onComplete={() => completeStep('projectInfo')}
          />
        );
      case 'data':
        return (
          <DataUpload
            jsPsychMetadata={jsPsychMetadata}
            dataProcessed={dataProcessed}
            existingMetadataLoaded={existingLoaded}
            onComplete={() => { setDataProcessed(true); completeStep('data'); }}
            onResetMetadata={resetMetadata}
            onBusyChange={setDataBusy}
            session={dataSession}
            onSessionChange={setDataSession}
          />
        );
      case 'variables':
        return <Variables jsPsychMetadata={jsPsychMetadata} onComplete={() => completeStep('variables')} />;
      case 'authors':
        return <Authors jsPsychMetadata={jsPsychMetadata} onComplete={() => completeStep('authors')} />;
      case 'review':
        return (
          <Review
            jsPsychMetadata={jsPsychMetadata}
            dataFiles={dataSession.convertedStore}
            onDownloaded={() => setDownloaded(true)}
          />
        );
    }
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        canNavigateTo={canNavigateTo}
        onNavigate={(stepId) => { if (!dataBusy && canNavigateTo(stepId)) setCurrentStep(stepId); }}
        onStartOver={handleStartOver}
        locked={dataBusy}
      />
      <main className={styles.content}>
        {renderStep()}
      </main>

      {currentStep !== 'review' && (
        <button
          className={styles.previewPill}
          onClick={() => setPreviewOpen(true)}
          aria-label="Open JSON preview"
        >
          <span className={styles.previewPillIcon}>{'{}'}</span>
          Preview
        </button>
      )}

      {previewOpen && (
        <PreviewDrawer
          jsPsychMetadata={jsPsychMetadata}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default AppShell;

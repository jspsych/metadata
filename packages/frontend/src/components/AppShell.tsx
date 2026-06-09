import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Sidebar from './Sidebar';
import ProjectInfo, { ProjectInfoSession, emptyProjectInfoSession } from '../pages/ProjectInfo';
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
  const isExistingProject = !!existingMetadataFile;

  const [currentStep, setCurrentStep] = useState<StepId>('projectInfo');
  // Pre-complete the Data step for existing projects — variables are already loaded from the JSON
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(
    () => isExistingProject ? new Set<StepId>(['data']) : new Set<StepId>()
  );
  const [dataProcessed, setDataProcessed] = useState(false);
  const [dataSession, setDataSession] = useState<DataSession>(emptyDataSession);
  const [projectInfoSession, setProjectInfoSession] = useState<ProjectInfoSession>(
    () => emptyProjectInfoSession()
  );

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
            existingMetadataLoaded={isExistingProject}
            onComplete={() => { setDataProcessed(true); completeStep('data'); }}
            session={dataSession}
            onSessionChange={setDataSession}
          />
        );
      case 'variables':
        return <Variables jsPsychMetadata={jsPsychMetadata} onComplete={() => completeStep('variables')} />;
      case 'authors':
        return <Authors jsPsychMetadata={jsPsychMetadata} onComplete={() => completeStep('authors')} />;
      case 'review':
        return <Review jsPsychMetadata={jsPsychMetadata} dataFiles={dataSession.fileTexts} />;
    }
  };

  return (
    <div className={styles.shell}>
      <Sidebar
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        canNavigateTo={canNavigateTo}
        onNavigate={(stepId) => { if (canNavigateTo(stepId)) setCurrentStep(stepId); }}
        onStartOver={onStartOver}
      />
      <main className={styles.content}>
        {renderStep()}
      </main>
    </div>
  );
};

export default AppShell;

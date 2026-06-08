import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import Sidebar from './Sidebar';
import ProjectInfo from '../pages/ProjectInfo';
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
  const [completedSteps, setCompletedSteps] = useState<Set<StepId>>(new Set());
  const [dataProcessed, setDataProcessed] = useState(false);
  const [dataSession, setDataSession] = useState<DataSession>(emptyDataSession);

  const completeStep = (stepId: StepId) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    const idx = STEPS.findIndex(s => s.id === stepId);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].id);
  };

  const canNavigateTo = (stepId: StepId): boolean => {
    const idx = STEPS.findIndex(s => s.id === stepId);
    if (idx === 0) return true;
    return completedSteps.has(STEPS[idx - 1].id);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'projectInfo':
        return (
          <ProjectInfo
            jsPsychMetadata={jsPsychMetadata}
            existingMetadataFile={existingMetadataFile}
            onComplete={() => completeStep('projectInfo')}
          />
        );
      case 'data':
        return (
          <DataUpload
            jsPsychMetadata={jsPsychMetadata}
            dataProcessed={dataProcessed}
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
        return <Review jsPsychMetadata={jsPsychMetadata} />;
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

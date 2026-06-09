import { useState } from 'react';
import { StepId } from './AppShell';
import styles from './Sidebar.module.css';
import logo from '../assets/jspsych-logo-no-text.svg';

interface Step {
  id: StepId;
  label: string;
}

interface SidebarProps {
  steps: Step[];
  currentStep: StepId;
  completedSteps: Set<StepId>;
  canNavigateTo: (stepId: StepId) => boolean;
  onNavigate: (stepId: StepId) => void;
  onStartOver: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  steps,
  currentStep,
  completedSteps,
  canNavigateTo,
  onNavigate,
  onStartOver,
}) => {
  const [confirming, setConfirming] = useState(false);

  return (
    <nav className={styles.sidebar}>
      <div className={styles.header}>
        <img src={logo} alt="" className={styles.logo} />
        <span className={styles.appTitle}>jsPsych Metadata</span>
      </div>
      <ul className={styles.stepList}>
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.has(step.id);
          const isLocked = !canNavigateTo(step.id) && !isActive;

          const cls = [
            styles.step,
            isActive && styles.active,
            isCompleted && !isActive && styles.completed,
            isLocked && styles.locked,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <li key={step.id}>
              <button
                className={cls}
                onClick={() => onNavigate(step.id)}
                disabled={isLocked}
              >
                <span className={styles.indicator}>
                  {isCompleted ? '✓' : <span className={styles.dot} />}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer}>
        <a
          className={styles.psychdsLink}
          href="https://psychds-docs.readthedocs.io/en/latest/"
          target="_blank"
          rel="noreferrer"
        >
          What is Psych-DS? ↗
        </a>
        <button className={styles.startOver} onClick={() => setConfirming(true)}>
          ← Start over
        </button>
      </div>

      {confirming && (
        <div className={styles.overlay} onClick={() => setConfirming(false)}>
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.dialogTitle}>Start over?</h3>
            <p className={styles.dialogText}>
              All progress will be lost and you'll return to the welcome screen.
            </p>
            <div className={styles.dialogButtons}>
              <button className={styles.confirmYes} onClick={onStartOver}>
                Yes, start over
              </button>
              <button className={styles.confirmCancel} onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Sidebar;

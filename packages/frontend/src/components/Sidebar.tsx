import { useLayoutEffect, useRef, useState } from 'react';
import { StepId } from './AppShell';
import styles from './Sidebar.module.css';
import logo from '../assets/jspsych-logo-no-text.svg';

/** True when running inside an iframe (embedded on the docs site). */
const isEmbedded = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

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
  /** When true (e.g. data is processing) all navigation is disabled so a run can't be orphaned. */
  locked?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  steps,
  currentStep,
  completedSteps,
  canNavigateTo,
  onNavigate,
  onStartOver,
  locked = false,
}) => {
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    if (confirming) dialogRef.current?.showModal();
  }, [confirming]);

  return (
    <nav className={styles.sidebar}>
      {/* When embedded on the docs site, the site navbar already shows the
          brand, so hide this duplicate header. */}
      {!isEmbedded() && (
        <div className={styles.header}>
          <img src={logo} alt="" className={styles.logo} />
          <span className={styles.appTitle}>jsPsych Metadata</span>
        </div>
      )}
      <ul className={styles.stepList}>
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isCompleted = completedSteps.has(step.id);
          const isLocked = locked || (!canNavigateTo(step.id) && !isActive);

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
          href="https://metadata.jspsych.org/docs/introduction"
          target="_blank"
          rel="noreferrer"
        >
          What is Psych-DS? ↗
        </a>
        <button className={styles.startOver} onClick={() => setConfirming(true)} disabled={locked}>
          ← Start over
        </button>
      </div>

      {confirming && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby="startover-title"
          aria-describedby="startover-desc"
          onClose={() => setConfirming(false)}
        >
          <h3 id="startover-title" className={styles.dialogTitle}>Start over?</h3>
          <p id="startover-desc" className={styles.dialogText}>
            This clears the data you uploaded and everything you've entered, and takes you back to
            the start screen. Your own files on disk are not touched.
          </p>
          <div className={styles.dialogButtons}>
            <button className={styles.confirmYes} onClick={onStartOver}>
              Yes, start over
            </button>
            <button className={styles.confirmCancel} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </dialog>
      )}
    </nav>
  );
};

export default Sidebar;

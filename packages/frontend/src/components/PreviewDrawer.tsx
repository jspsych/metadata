import { useMemo, useLayoutEffect, useRef } from 'react';
import JsPsychMetadata from '@jspsych/metadata';
import JsonViewer from './JsonViewer';
import styles from './PreviewDrawer.module.css';

interface PreviewDrawerProps {
  jsPsychMetadata: JsPsychMetadata;
  onClose: () => void;
}

const PreviewDrawer: React.FC<PreviewDrawerProps> = ({ jsPsychMetadata, onClose }) => {
  // Fresh snapshot on each open (component mounts when drawer opens)
  const data = useMemo(() => jsPsychMetadata.getMetadata(), []);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // A native <dialog> opened with showModal() gives a real focus trap, Escape-to-close, and an
  // inert backdrop for free (mirroring Sidebar's confirm dialog). Escape fires 'cancel' → onClose.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // A click landing on the dialog element itself (not its content) is a backdrop click → close.
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-label="JSON preview"
      onClose={onClose}
      onCancel={onClose}
      onClick={handleClick}
    >
      <div className={styles.drawerHeader}>
        <span className={styles.drawerTitle}>JSON preview</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">×</button>
      </div>
      <div className={styles.drawerBody}>
        <JsonViewer data={data} />
      </div>
    </dialog>
  );
};

export default PreviewDrawer;

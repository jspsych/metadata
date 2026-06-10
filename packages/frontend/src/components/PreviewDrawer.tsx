import { useMemo } from 'react';
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

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div className={styles.drawer} role="dialog" aria-label="JSON preview">
        <div className={styles.drawerHeader}>
          <span className={styles.drawerTitle}>JSON Preview</span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">×</button>
        </div>
        <div className={styles.drawerBody}>
          <JsonViewer data={data} />
        </div>
      </div>
    </>
  );
};

export default PreviewDrawer;

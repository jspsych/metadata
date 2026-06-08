import JsPsychMetadata from '@jspsych/metadata';

interface DataUploadProps {
  jsPsychMetadata: JsPsychMetadata;
  onComplete: () => void;
}

const DataUpload: React.FC<DataUploadProps> = ({ onComplete }) => {
  return (
    <div>
      <h2>Data</h2>
      <p>Coming soon — upload data folder, processing status, join key chooser.</p>
      <button onClick={onComplete}>Continue</button>
    </div>
  );
};

export default DataUpload;

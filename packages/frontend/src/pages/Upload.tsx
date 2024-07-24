import UploadMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import GenerateMetadata from '../components/GenerateMetadata.tsx';
import Preview from '../components/Preview.tsx'; // will need to include with the rest
import JsPsychMetadata from 'metadata';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
  setPage: (s: string) => void;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata, setPage }) => {
  return (
    <>
      <div className="uploadPage">
        <UploadMetadata jsPsychMetadata={jsPsychMetadata} />
        <UploadData jsPsychMetadata={jsPsychMetadata} />
        <button onClick={() => setPage('viewOptions')}>continue</button>
        {/* <GenerateMetadata jsPsychMetadata={jsPsychMetadata} /> */}
        {/* include a preview here later */}
      </div>
    </>
  )
}

export default Upload;
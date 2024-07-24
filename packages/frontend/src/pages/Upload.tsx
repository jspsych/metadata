import UploadMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import GenerateMetadata from '../components/GenerateMetadata.tsx';
import Preview from '../components/Preview.tsx'; // will need to include with the rest
import JsPsychMetadata from 'metadata';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata }) => {
  return (
    <>
      <UploadMetadata jsPsychMetadata={jsPsychMetadata} />
      <UploadData jsPsychMetadata={jsPsychMetadata} />
      <GenerateMetadata jsPsychMetadata={jsPsychMetadata} />
      {/* include a preview here later */}
    </>
  )
}

export default Upload;
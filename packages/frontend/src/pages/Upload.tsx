import UploadMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import JsPsychMetadata from 'metadata';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
  setPage: (s: string) => void;
  updateMetadataString: () => void;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata, setPage, updateMetadataString }) => {
  return (
    <>
      <div className="uploadPage">
        <UploadMetadata jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} />
        <UploadData jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString}/>
        <button className="upload-continue" onClick={() => setPage('viewOptions')}>Continue</button>
      </div>
    </>
  )
}

export default Upload;
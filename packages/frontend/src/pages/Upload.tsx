import { useState } from 'react'
import ExistingMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import GenerateMetadata from '../components/GenerateMetadata.tsx';
import Preview from '../components/Preview.tsx'; // will need to include with the rest
import JsPsychMetadata from 'metadata';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata }) => {

  const [metadata, setMetadata] = useState<string>(); // pretty sure can be deleted
  const [data, setData] = useState<string[]>();
  const [finalMetadata, setFinalMetadata] = useState<string>(); // pretty sure can deleted 

  return (
    <>
      <ExistingMetadata setMetadata={setMetadata} jsPsychMetadata={jsPsychMetadata}/>
      <UploadData setData={setData} setFinalMetadata={setFinalMetadata} jsPsychMetadata={jsPsychMetadata} />
      <GenerateMetadata data={data} metadata={metadata} setFinalMetadata={setFinalMetadata}/>
      {/* include a preview here later */}
    </>
  )
}

export default Upload;
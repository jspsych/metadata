import { useState } from 'react'
import ExistingMetadata from '../components/ExistingMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import GenerateMetadata from '../components/GenerateMetadata.tsx';


//var jsPsychMetadata = new JsPsychMetadata();

export default function Metadata() {
  const [metadata, setMetadata] = useState<string>();
  const [data, setData] = useState<string[]>();
  const [finalMetadata, setFinalMetadata] = useState<string>();

  return (
    <>
      <ExistingMetadata setMetadata={setMetadata} />
      <UploadData setData={setData} setFinalMetadata={setFinalMetadata} />
      <GenerateMetadata data={data} metadata={metadata} setFinalMetadata={setFinalMetadata}/>
      <MetadataPreview finalMetadata={finalMetadata} />
    </>
  )
}

function MetadataPreview({finalMetadata} : {finalMetadata: string | undefined}) {
  if (finalMetadata){
    return (
      <div className="App">
        <h2>Metadata preview</h2>
        <p>{finalMetadata}</p>
      </div>
    )
  }
}


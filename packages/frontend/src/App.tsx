import { useState } from 'react'
import { Button, VStack } from '@chakra-ui/react'
// import useExternalScripts from './useExternalScripts'
//import JsPsychMetadata from '../../metadata/src/index'
import { FaUpload } from "react-icons/fa"; // Icon for the upload button/Likely will finetune
import ExistingMetadata from './pages/existingMetadata.tsx';
import Options from './pages/Options.tsx'
import UploadData from './pages/uploadData.tsx';
import GenerateButton from './pages/generateMetadata.tsx';



import './App.css'

//var jsPsychMetadata = new JsPsychMetadata();

function App() {
  const [metadata, setMetadata] = useState<string>();
  const [data, setData] = useState<string[]>();
  const [finalMetadata, setFinalMetadata] = useState<string>();

  return (
    <>
    <ExistingMetadata setMetadata={setMetadata} />
    <UploadData setData={setData} />
    <Options />
    <GenerateButton data={data} metadata={metadata} setFinalMetadata={setFinalMetadata} />
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
export default App

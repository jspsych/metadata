import Metadata from "./pages/Upload.tsx";
import Options from './pages/Options.tsx'
import JsPsychMetadata from 'metadata';
import ViewOptions from "./pages/ViewOptions.tsx";
import { useState } from 'react';
import './App.css'


function App() {
  const jsPsychMetadata = new JsPsychMetadata();
  // const [ metadataString, setMetadataString ] = useState(JSON.stringify(jsPsychMetadata.getMetadata())); // this is the metadata string that willl keep track of metadata

  return (
    <>
      {/* <Metadata jsPsychMetadata={jsPsychMetadata}/> / */}
      {/* <button onClick={() => console.log(jsPsychMetadata.getMetadata())}>console.logMetadata</button> */}
      {/* <Options jsPsychMetadata={jsPsychMetadata}/> */}
      <ViewOptions jsPsychMetadata={jsPsychMetadata} />
    </>
  )
}

export default App;
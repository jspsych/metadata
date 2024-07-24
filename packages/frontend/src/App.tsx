import Metadata from "./pages/Upload.tsx";
import Options from './pages/Options.tsx'
import JsPsychMetadata from 'metadata';
import ViewOptions from "./pages/ViewOptions.tsx";
import { useState } from 'react';
import './App.css'


function App() {
  const [jsPsychMetadata] = useState(new JsPsychMetadata());
  const [ metadataString, setMetadataString ] = useState(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2)); // this is the metadata string that willl keep track of metadata

    // whenever updates will just call pretty version 
  const updateMetadataString = () => { 
    setMetadataString(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2));
  }

  return (
    <>
      <div className="appPage">
      {/* <Metadata jsPsychMetadata={jsPsychMetadata}/> / */}
      {/* <button onClick={() => console.log(jsPsychMetadata.getMetadata())}>console.logMetadata</button> */}
      {/* <Options jsPsychMetadata={jsPsychMetadata}/> */}
      <ViewOptions jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} updateMetadataString={updateMetadataString}/>
      </div>
    </>
  )
}

export default App;
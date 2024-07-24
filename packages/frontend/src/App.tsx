import Upload from "./pages/Upload.tsx";
import Options from './pages/Options.tsx'
import JsPsychMetadata from 'metadata';
import ViewOptions from "./pages/ViewOptions.tsx";
import { useState } from 'react';
import './App.css'


function App() {
  const [jsPsychMetadata] = useState(new JsPsychMetadata());
  const [ metadataString, setMetadataString ] = useState(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2)); // this is the metadata string that willl keep track of metadata
  const [ page, setPage ] = useState('upload');

  // whenever updates will just call pretty version 
  const updateMetadataString = () => { 
    setMetadataString(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2));
  }

  const renderPage = () => {
    switch (page) {
      case 'upload':
        return <Upload jsPsychMetadata={jsPsychMetadata} setPage={setPage}/>; // NEED TO PASS IN UPDATE METADATA SO THAT WILL UPDATE STRING WHEN LOADING
      case 'viewOptions':
        return <ViewOptions jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} updateMetadataString={updateMetadataString}/>; // NEED TO PASS SETPAGE ELEMENT
      default:
        return null;
    }
  };

  return (
    <>
      <div className="appPage">
        {renderPage()}

        {/* <Upload jsPsychMetadata={jsPsychMetadata}/> / */}
        {/* <button onClick={() => console.log(jsPsychMetadata.getMetadata())}>console.logMetadata</button> */}
        {/* <Options jsPsychMetadata={jsPsychMetadata}/> */}
        {/* <ViewOptions jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} updateMetadataString={updateMetadataString}/> */}
      </div>
    </>
  )
}

export default App;
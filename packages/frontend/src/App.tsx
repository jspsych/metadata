import Upload from "./pages/Upload.tsx";
import JsPsychMetadata from '@jspsych/metadata';
import ViewOptions from "./pages/ViewOptions.tsx";
import { useState } from 'react';
import './App.css'


function App() {
  const [jsPsychMetadata] = useState(new JsPsychMetadata()); // metadata objct
  const [ metadataString, setMetadataString ] = useState(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2)); // this is the metadata string that willl keep track of metadata
  const [ page, setPage ] = useState('viewOptions'); // page logic, change back to upload when done working with preview page
  // const [ fileList, setFileList ] = useState<File[]>([]); -> this allows to download and save

  // whenever updates will just call pretty version 
  const updateMetadataString = () => { 
    setMetadataString(JSON.stringify(jsPsychMetadata.getMetadata(), null, 2));
  }

  // logic for rendering pages
  const renderPage = () => {
    switch (page) {
      case 'upload':
        return <Upload jsPsychMetadata={jsPsychMetadata} setPage={setPage} updateMetadataString={updateMetadataString} />; // NEED TO PASS IN UPDATE METADATA SO THAT WILL UPDATE STRING WHEN LOADING
      case 'viewOptions':
        return <ViewOptions jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} updateMetadataString={updateMetadataString}/>; // NEED TO PASS SETPAGE ELEMENT
      default:
        console.warn("uncaught page render:", page);
        return <Upload jsPsychMetadata={jsPsychMetadata} setPage={setPage} updateMetadataString={updateMetadataString} />; // NEED TO PASS IN UPDATE METADATA SO THAT WILL UPDATE STRING WHEN LOADING
    }

  };

  return (
    <>
      <div className="appPage">
        {renderPage()}
      </div>
    </>
  )
}

export default App;
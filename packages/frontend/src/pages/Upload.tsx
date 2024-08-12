import UploadMetadata from '../components/upload/UploadMetadata.tsx';
import UploadData from '../components/upload/UploadData.tsx';
import JsPsychMetadata from '@jspsych/metadata';
import AuthorForm from '../components/upload/AuthorForm.tsx';
import { useState } from 'react';
import PromptForm from '../components/upload/PromptForm.tsx';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
  setPage: (s: string) => void;
  updateMetadataString: () => void;
  startScreen?: string; // optional parameter to determien which of upload screens begins at
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata, setPage, updateMetadataString, startScreen }) => {
  const [ dataScreen, setDataScreen] = useState(startScreen ? startScreen: 'metadata');
  const [ buttonText, setButtonText ] = useState('Skip');
  const [ pageNumber, setPageNumber ] = useState<number>(startScreen ? 4 : 1); // bad way to write, but fixes immediate logic of displayData
 
  const handleScreenChange = (newPage?: string, newButtonText?: string) => {
    if (newPage !== undefined){ 
      setDataScreen(newPage);
      switch (newPage) {
        case 'metadata':
          setPageNumber(1);
          setButtonText("Skip");
          break;
        case 'form':
          setPageNumber(2);
          // setButtonText("Save"); - handled within components & static
          break;
        case 'author':
          setPageNumber(3);
          // setButtonText("Submit"); - handled within components & static
          break;
        case 'data':
          setPageNumber(4);
          setButtonText("Skip");
      }
    }

    if (newButtonText !== undefined) setButtonText(newButtonText);
  }
  
  const renderPage = () => {
    switch (dataScreen){
      case 'metadata':
        return <UploadMetadata jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} handleScreenChange={handleScreenChange}/>
      case 'form':
        return <PromptForm jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} handleScreenChange={handleScreenChange}/>;
      case 'author': 
        return <AuthorForm jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} handleScreenChange={handleScreenChange}/>
      case 'data':
        return <UploadData jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} handleScreenChange={handleScreenChange} />
    } 
  }

  const renderButton = () => {
    switch (dataScreen){
      case 'metadata':
        return <button 
                className="upload-continue" 
                onClick={() => {
                  handleScreenChange('form', 'Skip'); // not sure if perfectly replaces -> setButtonText('Skip')
                }}>
                  {buttonText}
               </button>; 
      case 'form':
        return; // this will be handled internally to tie behavior with the form
      case 'author':
        return; // this will be handled internally to tie behavior with form
      case 'data':
        return <div className="backSubmitButtonContainer">
                <button 
                  className="upload-back" 
                  onClick={() => {
                    handleScreenChange("author", "Save");
                  }}>
                    Back
                </button>
                <button 
                  className="upload-continue" 
                  onClick={() => {
                    setPage('viewOptions') // can't use handle screenChange because setPage not included, could update to handle 'viewOptions
                    setButtonText('Skip')
                  }}>
                    {buttonText}
                </button>
               </div>;
    }
  }
  
  return (
    <>
      <div className="uploadPage">
        <h2>{pageNumber}/4</h2>
        {renderPage()}
        {renderButton()}
      </div>
    </>
  )
}

export default Upload;
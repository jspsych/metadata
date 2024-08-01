import UploadMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import JsPsychMetadata from 'metadata';
import { useState } from 'react';
import PromptForm from '../components/PromptForm.tsx';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
  setPage: (s: string) => void;
  updateMetadataString: () => void;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata, setPage, updateMetadataString }) => {
  const [ dataScreen, setDataScreen] = useState('metadata');
  const [ buttonText, setButtonText ] = useState('Skip');
  const [ pageNumber, setPageNumber ] = useState<number>(1);

  const handleScreenChange = (newPage?: string, newButtonText?: string) => {
    if (newPage !== undefined){ 
      setDataScreen(newPage);
      switch (newPage) {
        case 'metadata':
          setPageNumber(1);
          break;
        case 'form':
          setPageNumber(2);
          break;
        case 'data':
          setPageNumber(3);
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
                  handleScreenChange('form');
                  setButtonText('Skip')
                }}>
                  {buttonText}
               </button>; 
      case 'form':
        return; // this will be handled internally to tie behavior with the form
      case 'data':
        return <button 
                  className="upload-continue" 
                  onClick={() => {
                    setPage('viewOptions')
                    setButtonText('Skip')
                  }}>
                    {buttonText}
                </button>;
    }
  }
  
  return (
    <>
      <div className="uploadPage">
        <h2>{pageNumber}/3</h2>
        {renderPage()}
        {renderButton()}
      </div>
    </>
  )
}

export default Upload;
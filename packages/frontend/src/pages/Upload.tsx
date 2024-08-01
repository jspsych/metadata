import UploadMetadata from '../components/UploadMetadata.tsx';
import UploadData from '../components/UploadData.tsx';
import JsPsychMetadata from 'metadata';
import { useState } from 'react';

interface UploadProps {
  jsPsychMetadata: JsPsychMetadata;
  setPage: (s: string) => void;
  updateMetadataString: () => void;
} 

const Upload: React.FC<UploadProps> = ( { jsPsychMetadata, setPage, updateMetadataString }) => {
  const [ dataScreen, setDataScreen] = useState('metadata');
  const [ buttonText, setButtonText ] = useState('Skip');
  const [ prevMetadata, setPrevMetadata ] = useState<boolean>(false);
  const [ pageNumber, setPageNumber ] = useState<number>(1);

  const handleScreenChange = (newPage?: string, newButtonText?: string) => {
    if (newPage !== undefined){ 
      setDataScreen(newPage);
      switch (newPage) {
        case 'metadata':
          setPageNumber(1);
          break;
        case 'form':
          if (prevMetadata) handleScreenChange('data', newButtonText);
          else setPageNumber(2);
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
        return <UploadMetadata jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} setPrevMetadata={setPrevMetadata} handleScreenChange={handleScreenChange}/>
      case 'form':
        return <p>this is the form</p>;
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
        return <button className="upload-continue" onClick={() => handleScreenChange('data')}>{buttonText}</button>; 
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
        <h1>{pageNumber}/3</h1>
        {renderPage()}
        {renderButton()}
      </div>
    </>
  )
}

export default Upload;
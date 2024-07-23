import { useState, useEffect } from 'react';


type UploadDataProps = {
    setData: (data: string[]) => void;
    setFinalMetadata: (metadata: string) => void;
  };

interface GenerateButtonProps {
  data: string[] | undefined;
  metadata: string | undefined;
  setFinalMetadata: (metadata: string) => void;
}

export default function UploadData({ setData, setFinalMetadata }: UploadDataProps) {
    //const jsPsychpath = "/index.js";

    const [fileList, setFileList] = useState<File[]>();
  
    //useExternalScripts(jsPsychpath);
  
    let filesInAnArray: string[] = [];
  
    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  
      if (event.target.files) {
        setFileList([...event.target.files]);
      }
    }

    function loadFiles(event: React.FormEvent<HTMLFormElement>) {
      console.log('loadFiles', filesInAnArray);
      event.preventDefault();
      setData(filesInAnArray);
      console.log('set', filesInAnArray);

      const promises = (fileList as File[]).map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
  
          reader.onload = () => {
            console.log(reader.result);
            resolve(reader.result as string); // Resolve the promise with the file content.
          };
  
          reader.onerror = reject; // Reject the promise on error.
  
          reader.readAsText(file); // Read the file as text.
        });
      });
  
      Promise.all(promises).then(contents => {
        filesInAnArray = contents; // Update filesInAnArray with all file contents.
        setData(filesInAnArray); // Update the state with the new array.
        
      }).catch(error => {
        console.error("Error reading files:", error);
      });
    }
  
    return (
        <div className="App">
          <h2>Data file supload</h2>
          <form onSubmit={loadFiles}>
          <input type='file' multiple onChange={handleFileUpload}/>
          <button type="submit">Upload</button>
          </form>
        </div>
      )
  }


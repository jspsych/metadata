import { useState } from 'react'


type UploadDataProps = {
    setData: (data: string[]) => void;
  };




  
export default function UploadData({ setData }: UploadDataProps) {
    //const jsPsychpath = "/index.js";

    const [fileString, setFileString] = useState<string[]>();
  
    //useExternalScripts(jsPsychpath);
  
    let filesInAnArray: string[] = [];
  
    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  
      if (event.target.files) {
    
        const fileList = [...event.target.files];

        const promises = fileList.map(file => {
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
          setFileString(filesInAnArray);
        }).catch(error => {
          console.error("Error reading files:", error);
        });
      
    }
    }
    function loadFiles(event: React.FormEvent<HTMLFormElement>) {
      console.log('loadFiles', filesInAnArray);
      event.preventDefault();
      setData(filesInAnArray);
      console.log('set', filesInAnArray);
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
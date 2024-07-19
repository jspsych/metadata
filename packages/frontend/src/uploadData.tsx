import { useState } from 'react'

type UploadDataProps = {
    setData: (data: string[]) => void;
  };
  
export default function UploadData({ setData }: UploadDataProps) {
    const [files, setFiles] = useState<File[]>([]);
    //const jsPsychpath = "/index.js";
  
    //useExternalScripts(jsPsychpath);
  
    let filesInAnArray: string[] = [];
  
    function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  
      if (event.target.files) {
        console.log(event.target.files);
        setFiles([...event.target.files]);
    
        const promises = Array.from(files).map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
    
            reader.onload = () => {
              resolve(reader.result as string); // Resolve the promise with the file content.
            };
    
            reader.onerror = reject; // Reject the promise on error.
    
            reader.readAsText(file); // Read the file as text.
          });
        });
    
        Promise.all(promises).then(contents => {
          filesInAnArray = contents; // Update filesInAnArray with all file contents.
          setData(filesInAnArray); // Update the state with the new array.
          console.log(filesInAnArray);
        }).catch(error => {
          console.error("Error reading files:", error);
        });
      
    }
    }
    function loadFiles() {
      setData(filesInAnArray);
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
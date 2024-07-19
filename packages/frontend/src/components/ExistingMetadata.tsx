import { useState } from 'react'

type ExistingDataProps = {
    setMetadata: (metadata: string) => void;
  };
export default function ExistingMetadata({setMetadata}: ExistingDataProps) {
    const [metadataHolder, setMetadataHolder] = useState<File>();
  
    function handleMetadataUpload(event: React.ChangeEvent<HTMLInputElement>) {
      if (event.target.files) setMetadataHolder(event.target.files[0]);
    }
 
    function loadMetadata(event: React.FormEvent<HTMLFormElement>) {
      
      event.preventDefault(); 

      if (metadataHolder) { 
        const reader = new FileReader();
  
        const promise = new Promise<string>( (resolve) => {
          
          reader.onload = () => {
          resolve(reader.result as string); // Metadata is asserted to be a string.
        };
  
        reader.readAsText(metadataHolder);
        });
  
        promise.then(metadata => {
        setMetadata(metadata);
        console.log("Metadata file uploaded:", metadata);
      }).catch(error => {console.error("Error reading metadata file:", error);});
    }
  }
  
    return (
      <div className="App">
        <h2>Metadata file upload</h2>
        <form onSubmit={loadMetadata}>
        <input type='file' onChange={handleMetadataUpload}/>
        <button type="submit">Upload</button>
        </form>
      </div>
    )
  };
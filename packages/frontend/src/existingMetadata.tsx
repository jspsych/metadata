import { useState } from 'react'

type ExistingDataProps = {
    setMetadata: (metadata: string) => void;
  };
export default function ExistingMetadata({setMetadata}: ExistingDataProps) {
    const [metadataHolder, setMetadataHolder] = useState<File>();
  
    let metadataAsString: string;
  
    function handleMetadataUpload(event: React.ChangeEvent<HTMLInputElement>) {
      if (event.target.files) {
        setMetadataHolder(event.target.files[0]);
  
        const reader = new FileReader();
  
        const promise = new Promise<string>( (resolve, error) => {
          
          reader.onload = () => {
          resolve(reader.result as string); // Metadata is asserted to be a string.
        };
  
        if(metadataHolder) reader.readAsText(metadataHolder);
        });
  
        promise.then(metadata => {
        metadataAsString = metadata;
      }).catch(error => {console.error("Error reading metadata file:", error);});
    }
  };
  
    function loadMetadata(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      console.log(metadataAsString);
      setMetadata(metadataAsString);
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
  }
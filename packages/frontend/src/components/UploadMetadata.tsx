import JsPsychMetadata from 'metadata';
import { useState } from 'react'

type UploadMetadataProps = {
  setMetadata: (metadata: string) => void;
  jsPsychMetadata: JsPsychMetadata;
};

const UploadMetadata: React.FC<UploadMetadataProps> = ( {setMetadata, jsPsychMetadata } ) => {
  const [metadataHolder, setMetadataHolder] = useState<File>();
  
  function handleMetadataUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) setMetadataHolder(event.target.files[0]);
  }
 
  async function loadMetadata(event: React.FormEvent<HTMLFormElement>) {
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

        jsPsychMetadata.loadMetadata(metadata);
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

export default UploadMetadata;
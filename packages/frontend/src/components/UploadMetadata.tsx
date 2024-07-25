import JsPsychMetadata from 'metadata';
import { useState } from 'react'

type UploadMetadataProps = {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void; 
};

const UploadMetadata: React.FC<UploadMetadataProps> = ( {jsPsychMetadata, updateMetadataString } ) => {
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
        jsPsychMetadata.loadMetadata(metadata);
        updateMetadataString();
      }).catch(error => {console.error("Error reading metadata file:", error);});
    }
  }

  
  return (
    <div className="uploadMetadataPage">
      <h2>Metadata file upload</h2>
      <p>
        If you have previously created and saved dataset_description.json files
        please upload here. 
      </p>
      <form onSubmit={loadMetadata}>
        <input type='file' onChange={handleMetadataUpload}/>
        <button type="submit">Upload</button> 
      </form>
    </div>
  )
};

export default UploadMetadata;
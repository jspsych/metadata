import JsPsychMetadata from 'metadata';
import { useState } from 'react'

type UploadMetadataProps = {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void; 
};

const UploadMetadata: React.FC<UploadMetadataProps> = ( {jsPsychMetadata, updateMetadataString } ) => {
  const [ metadataHolder, setMetadataHolder ] = useState<File>();
  const [ metadataStatus, setMetadataStatus ] = useState(""); 
  
  function handleMetadataUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files) setMetadataHolder(event.target.files[0]);
  }
 
  async function loadMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); 
    if (metadataHolder) { 
      if (metadataHolder.name === "dataset_description.json") {
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
          setMetadataStatus("Success")
        }).catch(error => {
          setMetadataStatus("Error reading metadata file:" + error);
          console.error("Error reading metadata file:", error);
        })
      } else {
        setMetadataStatus("Error: Incorrect file name. Please upload dataset_description.json.");
      }
    }
  }

  
  return (
    <div className="uploadMetadataPage">
      <h2>Metadata file upload</h2>
      <p>
        If you have previously created and saved a dataset_description.json file
        please upload here. Please upload before uploading datafiles otherwise there may be unwanted errors.
      </p>
      <form onSubmit={loadMetadata}>
        <input type='file' onChange={handleMetadataUpload}/>
        <button type="submit">Upload</button> 
      </form>
      <p>{metadataStatus}</p>
    </div>
  )
};

export default UploadMetadata;
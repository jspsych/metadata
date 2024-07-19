interface GenerateButtonProps {
  data: string[] | undefined;
  metadata: string | undefined;
  setFinalMetadata: (metadata: string) => void; 
}

export default function GenerateMetadata({data, metadata, setFinalMetadata}: GenerateButtonProps) {
  
  function generateMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log("Data", data);
    console.log("Metadata", metadata)
    
    if (!data) {
      console.log("No data files uploaded");
      return;
    }
    if (!metadata) console.log("No metadata file uploaded");

    setFinalMetadata("Data files uploaded: " + data + "Metadata file uploaded: " + metadata + "Metadata generated");

  }

  return (
    <div className="App"> 
      <form onSubmit={generateMetadata}>
      <button type='submit'>Generate metadata</button>
      </form>
    </div>
  )
}
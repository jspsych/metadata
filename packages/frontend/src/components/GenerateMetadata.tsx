import JsPsychMetadata from "metadata";

interface GenerateMetadataProps {
  jsPsychMetadata: JsPsychMetadata;
}

const GenerateMetadata:React.FC<GenerateMetadataProps> = ( {jsPsychMetadata} ) => {
  function generateMetadata(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <div className="App"> 
      <form onSubmit={generateMetadata}>
      <button type='submit'>Generate metadata</button>
      </form>
    </div>
  )
}

export default GenerateMetadata;
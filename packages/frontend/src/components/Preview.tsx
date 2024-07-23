import JsPsychMetadata from 'metadata';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
} 

const Preview: React.FC<PreviewProps> = ( { jsPsychMetadata } ) => {
  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <p>{JSON.stringify(jsPsychMetadata.getMetadata())}</p>
    </div>
  )
}

export default Preview;
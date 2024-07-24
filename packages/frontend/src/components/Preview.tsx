import JsPsychMetadata from 'metadata';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
} 

const Preview: React.FC<PreviewProps> = ( { jsPsychMetadata, metadataString } ) => {
  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <div>
        <pre>
          {metadataString}
        </pre>
      </div>    
    </div>
  )
}

export default Preview;
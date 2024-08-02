import JsPsychMetadata from '@jspsych/metadata';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
} 

const Preview: React.FC<PreviewProps> = ( { metadataString } ) => {
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
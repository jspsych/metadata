import JsPsychMetadata from '@jspsych/metadata';
import { useState } from 'react';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
} 

const Preview: React.FC<PreviewProps> = ( { jsPsychMetadata, metadataString } ) => {
  const [ metadataObject, setMetadataObject ] = useState<{ [key: string]: any }>(jsPsychMetadata.getUserMetadataFields()); // fields
  const [ authorsList, setAuthorsList ] = useState(jsPsychMetadata.getAuthorList()); // authors
  const [ variablesList, setVariablesList ] = useState(jsPsychMetadata.getVariableList()); // variables

  const updateState = () => {
    setMetadataObject(jsPsychMetadata.getUserMetadataFields());
    setAuthorsList(jsPsychMetadata.getAuthorList());
    setVariablesList(jsPsychMetadata.getVariableList());
  }

  const fields = () => {
    var res = "";

    for (const key in metadataObject){
      res += key + ": " + metadataObject[key] + "\n";
    }

    return res;
  }

  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <div>
        <pre>
          {fields()}
        </pre>
        {/* <pre>
          {metadataString}
        </pre> */}
      </div>    
    </div>
  )
}

export default Preview;
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

  const authors = () => {
    var res = ""; 

    for (const key in authorsList){
      res += authorsList[key] + "\n";
    }

    return res;
  }

  // need to build out logic for how to increment thorugh these
  const variables = () => {
    var res = ""; 

    // likely go through the fields and pick some that we want, and others that don't want
    for (const key in variablesList){
      res += JSON.stringify(variablesList[key]) + "\n";
    }

    return res;
  }

  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <div>
        <h3>Fields</h3>
        <pre>
          {fields()}
        </pre>
        <h3>Authors</h3>
        <pre>
          {authors()}
        </pre>
        <h3>Variables</h3>
        <pre>
          {variables()}
        </pre>
      </div>    
    </div>
  )
}

export default Preview;
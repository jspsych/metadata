import JsPsychMetadata from "@jspsych/metadata"; 
import Preview from "../components/Preview";
import Options from "./Options";

interface ViewOptionsProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
  updateMetadataString: () => void;
}

const ViewOptions: React.FC<ViewOptionsProps> = ( {jsPsychMetadata, metadataString, updateMetadataString } ) => {

  return ( 
    <>
      <div className="viewPage">
        <div className="viewPageLeft">
          <Preview jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} />
        </div>
        <div className="viewPageRight">
          <Options jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString}/>
        </div>
      </div>
    </>
  )
}

export default ViewOptions;
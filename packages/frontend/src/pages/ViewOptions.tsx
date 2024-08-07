import JsPsychMetadata from "@jspsych/metadata"; 
import Preview from "../components/Preview";
import Options from "./Options";

interface ViewOptionsProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
  updateMetadataString: () => void;
  setPage: (s: string) => void;
}

const ViewOptions: React.FC<ViewOptionsProps> = ( {jsPsychMetadata, metadataString, updateMetadataString, setPage } ) => {

  return ( 
    <>
      <div className="viewPage">
        <div className="viewPageLeft">
          <Preview jsPsychMetadata={jsPsychMetadata} metadataString={metadataString} updateMetadataString={updateMetadataString} />
        </div>
        <div className="viewPageRight">
          <Options jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} setPage={setPage}/>
        </div>
      </div>
    </>
  )
}

export default ViewOptions;
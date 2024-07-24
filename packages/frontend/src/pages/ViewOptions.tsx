import JsPsychMetadata from "metadata"; 
import Preview from "../components/Preview";
import Options from "./Options";

interface ViewOptionsProps {
  jsPsychMetadata: JsPsychMetadata;
}

const ViewOptions: React.FC<ViewOptionsProps> = ( {jsPsychMetadata } ) => {

  return ( 
    <>
      <div className="viewPage">
        <div className="viewPageLeft">
          <Preview jsPsychMetadata={jsPsychMetadata}/>
        </div>
        <div className="viewPageRight">
          <Options jsPsychMetadata={jsPsychMetadata} />
        </div>
      </div>
    </>
  )
}

export default ViewOptions;
import JsPsychMetadata from '@jspsych/metadata';

interface ProjectInfoProps {
  jsPsychMetadata: JsPsychMetadata;
  existingMetadataFile?: File;
  onComplete: () => void;
}

const ProjectInfo: React.FC<ProjectInfoProps> = ({ onComplete }) => {
  return (
    <div>
      <h2>Project Info</h2>
      <p>Coming soon — name, description, and optional Psych-DS fields.</p>
      <button onClick={onComplete}>Continue</button>
    </div>
  );
};

export default ProjectInfo;

import JsPsychMetadata from '@jspsych/metadata';

interface VariablesProps {
  jsPsychMetadata: JsPsychMetadata;
  onComplete: () => void;
}

const Variables: React.FC<VariablesProps> = ({ onComplete }) => {
  return (
    <div>
      <h2>Variables</h2>
      <p>Coming soon — accordion list with unknown descriptions flagged for fill-in.</p>
      <button onClick={onComplete}>Continue</button>
    </div>
  );
};

export default Variables;

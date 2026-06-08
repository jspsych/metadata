import JsPsychMetadata from '@jspsych/metadata';

interface AuthorsProps {
  jsPsychMetadata: JsPsychMetadata;
  onComplete: () => void;
}

const Authors: React.FC<AuthorsProps> = ({ onComplete }) => {
  return (
    <div>
      <h2>Authors</h2>
      <p>Coming soon — add and edit authors.</p>
      <button onClick={onComplete}>Continue</button>
    </div>
  );
};

export default Authors;

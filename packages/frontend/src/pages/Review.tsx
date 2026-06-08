import JsPsychMetadata from '@jspsych/metadata';

interface ReviewProps {
  jsPsychMetadata: JsPsychMetadata;
}

const Review: React.FC<ReviewProps> = ({ jsPsychMetadata }) => {
  return (
    <div>
      <h2>Review</h2>
      <p>Coming soon — full metadata preview, validator output, and download.</p>
      <button onClick={() => jsPsychMetadata.localSave()}>Download</button>
    </div>
  );
};

export default Review;

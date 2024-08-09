import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';

interface PromptFormProps {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
  handleScreenChange: (newPage?: string, newButtonText?: string) => void;
}

export type PromptFormData = {
  project_name: string;
  project_description: string;
};

const PromptForm: React.FC<PromptFormProps> = ({ jsPsychMetadata, updateMetadataString, handleScreenChange }) => {
  const [formData, setFormData] = useState<PromptFormData>({
    project_name: jsPsychMetadata.containsMetadataField("name") ? jsPsychMetadata.getMetadataField("name") : "", // try to load name
    project_description: jsPsychMetadata.containsMetadataField("description") ? jsPsychMetadata.getMetadataField("description") : "", // try to load description
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.project_name !== "") jsPsychMetadata.setMetadataField("name", formData.project_name);
    if (formData.project_description !== "") jsPsychMetadata.setMetadataField("description", formData.project_description);

    updateMetadataString();
    handleScreenChange('author', 'Save');
  };

  return (
    <>
      <h2>Project Information</h2>
      <p className="pageDescription">You can enter optional data about your project which will then be used to update the metadata file.</p>
      <form onSubmit={handleSubmit} className="promptFormSurvey">
        <div>
          <label htmlFor="project_name">Project name</label>
          <input
            type="text"
            id="project_name"
            name="project_name"
            value={formData.project_name}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="project_description">Project description</label>
          <input
            id="project_description"
            name="project_description"
            value={formData.project_description}
            onChange={handleChange}
          />
        </div>
        <button className="promptFormSubmit" type="submit">Save</button>
      </form>
    </>
  );
}

export default PromptForm;

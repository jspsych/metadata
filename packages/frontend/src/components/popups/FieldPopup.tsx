import JsPsychMetadata from 'metadata';
import React, { useState } from 'react';

type FieldPopup = {
  jsPsychMetadata: JsPsychMetadata; // maybe unnecessary
  onClose: () => void;
  onSave: (formData: FieldFormData, type: string, oldName?: string) => void;
  currentPopup: string;
  setPopupType: (type: string) => void;
  popupData: any;
};

export type FieldFormData = {
  fieldName: string;
  fieldDescription: string;
};

const FieldPopup: React.FC<FieldPopup> = ({ onClose, onSave, currentPopup, setPopupType, popupData }) => {
  const [oldName] = useState(popupData["fieldName"]) || "";

  const [formData, setFormData] = useState<FieldFormData>({
    fieldName: popupData["fieldName"] || "",
    fieldDescription: popupData["fieldDescription"] || "",
  });

  const [nameError, setNameError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!formData.fieldName) {
      setNameError('Field name is required');
      valid = false;
    } else setNameError(null);

    if (!formData.fieldDescription) {
      setDescriptionError('Field description is required');
      valid = false;
    } else setDescriptionError(null);

    if (valid) {
      // case where need to delete old reference
      if (oldName !== "" && oldName !== formData["fieldName"]) onSave(formData, 'field', oldName);
      else onSave(formData, 'field');
      onClose();
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div>
          <button className={currentPopup === 'field' ? 'activePopup' : ''} onClick={() => setPopupType('field')}>Add Field</button>
          <button className={currentPopup === 'author' ? 'activePopup' : ''} onClick={() => setPopupType('author')}>Add Author</button>
          <button className={currentPopup === 'variables' ? 'activePopup' : ''} onClick={() => setPopupType('variables')}>Add Variables</button>
        </div>
        <button className="close-button" onClick={onClose}>X</button>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="fieldName">field name <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              id="fieldName"
              name="fieldName"
              value={formData.fieldName}
              onChange={handleChange}
            />
            {nameError && <div style={{ color: 'red' }}>{nameError}</div>}
          </div>
          <div>
            <label htmlFor="fieldDescription">field description <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              id="fieldDescription"
              name="fieldDescription"
              value={formData.fieldDescription}
              onChange={handleChange}
            />
            {descriptionError && <div style={{ color: 'red' }}>{descriptionError}</div>}
          </div>
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  );
};

export default FieldPopup;

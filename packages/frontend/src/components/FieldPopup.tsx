import React, { useState } from 'react';

type FieldPopup = {
  onClose: () => void;
  onSave: (formData: FieldFormData) => void;
};

export type FieldFormData = {
  fieldName: string;
  fieldDescription: string;
};

const FieldPopup: React.FC<FieldPopup> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState<FieldFormData>({
    fieldName: '',
    fieldDescription: '',
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
    onSave(formData);
    onClose();
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <button className="close-button" onClick={onClose}>X</button>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="field">Field Name</label>
            <input
              type="text"
              id="fieldName"
              name="fieldName"
              value={formData.fieldName}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="fieldDescription">Field Description</label>
            <input
              type="text"
              id="fieldDescription"
              name="fieldDescription"
              value={formData.fieldDescription}
              onChange={handleChange}
            />
          </div>
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  );
};

export default FieldPopup;

import React, { useState } from 'react';
import FieldPopup from '../components/FieldPopup';

type FieldFormData = {
  fieldName: string;
  fieldDescription: string;
};

const Options: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState('');

  const openPopup = (type: string) => {
    setPopupType(type);
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setPopupType('');
  };

  const handleSave = (formData: FieldFormData) => {
    console.log('Form Data:', formData);
    // Perform save action here
  };

  const renderPopup = () => {
    switch (popupType) {
      case 'field':
        return <FieldPopup onClose={closePopup} onSave={handleSave} />;
      case 'author':
        // return <AuthorFormPopup onClose={closePopup} onSave={handleSave} />;
        return <FieldPopup onClose={closePopup} onSave={handleSave} />;
      case 'variables':
        return <FieldPopup onClose={closePopup} onSave={handleSave} />;
        // return <VariableFormPopup onClose={closePopup} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1>This is the options page</h1>
      <button onClick={() => openPopup('field')}>Edit field</button>
      <button onClick={() => openPopup('author')}>Edit author</button>
      <button onClick={() => openPopup('variables')}>Edit variables</button>

      {isPopupOpen && renderPopup()}
    </>
  );
};

export default Options;

import React, { useState } from 'react';
import FieldPopup, { FieldFormData } from '../components/FieldPopup';
import AuthorPopup, { AuthorFormData } from '../components/AuthorPopup';
import VariablePopup, { VariableFormData } from '../components/VariablePopup';

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

  // want to include the other ones here as well
  const handleSave = (formData: FieldFormData | AuthorFormData | VariableFormData) => {
    console.log('Form Data:', formData);
    // Perform save action here
  };

  const renderPopup = () => {
    switch (popupType) {
      case 'field':
        return <FieldPopup onClose={closePopup} onSave={handleSave} />;
      case 'author':
        return <AuthorPopup onClose={closePopup} onSave={handleSave} />;
      case 'variables':
        // return <FieldPopup onClose={closePopup} onSave={handleSave} />;
        return <VariablePopup onClose={closePopup} onSave={handleSave} />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1>Metadata Options</h1>
      <button onClick={() => openPopup('field')}>Edit field</button>
      <button onClick={() => openPopup('author')}>Edit author</button>
      <button onClick={() => openPopup('variables')}>Edit variables</button>

      {isPopupOpen && renderPopup()}
    </>
  );
};

export default Options;

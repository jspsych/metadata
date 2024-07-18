import React, { useState } from 'react';
import FieldPopup, { FieldFormData } from '../components/FieldPopup';
import AuthorPopup, { AuthorFormData } from '../components/AuthorPopup';
import VariablePopup, { VariableFormData } from '../components/VariablePopup';
import ListPopup from '../components/ListPopup';
import metadata from '../assets/dataset_description.json';

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
      case 'list':
        return <ListPopup onClose={closePopup} metadata={metadata}/>;
      case 'field':
        // add optional possibilities of object to add into the fields 
        return <FieldPopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} />;
      case 'author':
        return <AuthorPopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} />;
      case 'variables':
        return <VariablePopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} />;
      default:
        return null;
    }
  };

  return (
    <>
      <h1>Metadata Options</h1>

      <button onClick={() => openPopup('list')}>Edit metadata field</button>
      <button onClick={() => openPopup('field')}>Add metadata field</button>
      {isPopupOpen && renderPopup()}
    </>
  );
};

export default Options;

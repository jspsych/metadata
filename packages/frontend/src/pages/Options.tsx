import React, { useState } from 'react';
import FieldPopup, { FieldFormData } from '../components/FieldPopup';
import AuthorPopup, { AuthorFormData } from '../components/AuthorPopup';
import VariablePopup, { VariableFormData } from '../components/VariablePopup';
import ListPopup from '../components/ListPopup';
import metadata from '../assets/dataset_description.json';

const Options: React.FC = () => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupType, setPopupType] = useState('');
  const [popupData, setPopupData] = useState<any>({}); // State to hold popup-specific data

  const openPopup = (type: string, data?: any) => {
    setPopupType(type);
    setIsPopupOpen(true);
    if (data) setPopupData(data); else {};// Set optional data to pass to child popups
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setPopupType('');
    setPopupData({});
  };

  // want to include the other ones here as well
  const handleSave = (formData: FieldFormData | AuthorFormData | VariableFormData) => {
    console.log('Form Data:', formData);
    // Perform save action here
  }

  const renderPopup = () => {
    switch (popupType) {
      case 'list':
        return <ListPopup onClose={closePopup} metadata={metadata} setPopupType={setPopupType} setPopupData={setPopupData} />;
      case 'field':
        return <FieldPopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData} />;
      case 'author':
        return <AuthorPopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData} />;
      case 'variables':
        return <VariablePopup onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData}/>;
      default:
        return null;
    }
  };

  return (
    <>
      <h1>Metadata Options</h1>

      <button onClick={() => openPopup('list')}>Edit existing field</button>
      <button onClick={() => openPopup('field')}>Add metadata field</button>
      {isPopupOpen && renderPopup()}
    </>
  );
};

export default Options;

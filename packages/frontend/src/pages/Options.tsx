import React, { useState } from 'react';
import FieldPopup, { FieldFormData } from '../components/FieldPopup';
import AuthorPopup, { AuthorFormData } from '../components/AuthorPopup';
import VariablePopup, { VariableFormData } from '../components/VariablePopup';
import ListPopup from '../components/ListPopup';
import JsPsychMetadata from 'metadata';

interface OptionsProps {
  jsPsychMetadata: JsPsychMetadata;
}

const Options: React.FC<OptionsProps> = ( { jsPsychMetadata } ) => {
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

  const filterEmptyFields = (obj: Record<string, any>): Record<string, any> => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== "" && (Array.isArray(value) ? value.length > 0 : true)) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }
  
  // want to include the other ones here as well
  const handleSave = (formData: FieldFormData | AuthorFormData | VariableFormData, type: string) => {
    console.log('Form Data:', formData, "type:", type);
    switch (type){
      case 'field':
        const fieldData = formData as FieldFormData; // typecasting
        jsPsychMetadata.setMetadataField(fieldData["fieldName"], fieldData["fieldDescription"]);
        break;
      case 'author':
        // const fieldData = formData as FieldFormData; // typecasting
        // jsPsychMetadata.setMetadataField(fieldData["fieldName"], fieldData["fieldDescription"]);
        console.log("author");
        break;
      case 'variable':
        console.log("variable");
        break;
        // const fieldData = formData as FieldFormData; // typecasting
        // jsPsychMetadata.setMetadataField(fieldData["fieldName"], fieldData["fieldDescription"]);
      default: 
        console.warn("Submitting form returning with undefined type:", type);
    }

  }

  const renderPopup = () => {
    switch (popupType) {
      case 'list':
        return <ListPopup jsPsychMetadata={jsPsychMetadata} onClose={closePopup} setPopupType={setPopupType} setPopupData={setPopupData} />;
      case 'field':
        return <FieldPopup jsPsychMetadata={jsPsychMetadata} onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData} />;
      case 'author':
        return <AuthorPopup jsPsychMetadata={jsPsychMetadata} onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData} />;
      case 'variables':
        return <VariablePopup jsPsychMetadata={jsPsychMetadata} onClose={closePopup} onSave={handleSave} currentPopup={popupType} setPopupType={setPopupType} popupData={popupData}/>;
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

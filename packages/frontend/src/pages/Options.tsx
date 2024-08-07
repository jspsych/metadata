import React, { useState } from 'react';
import FieldPopup, { FieldFormData } from '../components/popups/FieldPopup';
import AuthorPopup, { AuthorFormData } from '../components/popups/AuthorPopup';
import VariablePopup, { VariableFormData } from '../components/popups/VariablePopup';
import ListPopup from '../components/popups/ListPopup';
import JsPsychMetadata, { AuthorFields, VariableFields } from '@jspsych/metadata';

interface OptionsProps {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
  setPage: (s: string) => void;
}

const Options: React.FC<OptionsProps> = ( { jsPsychMetadata, updateMetadataString, setPage } ) => {
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

  // THE AUTHOR single reference is not working as intended -> data not loaded correclty
  // if there is an oldName, willl want to delete it and rewrite new
  const handleSave = (formData: FieldFormData | AuthorFormData | VariableFormData, type: string, oldName?: string) => {
    switch (type){
      case 'field':
        const fieldData = formData as FieldFormData; // typecasting
        
        if ("fieldName" in fieldData && "fieldDescription" in fieldData && oldName && oldName !== ""){
          jsPsychMetadata.deleteMetadataField(oldName);
        } 

        jsPsychMetadata.setMetadataField(fieldData["fieldName"], fieldData["fieldDescription"]);
        break;
      case 'author':
        const author = formData as AuthorFormData; // typecasting
        const filteredAuthor = filterEmptyFields(author) as AuthorFields;

        // neeed to delete old reference  
        if ("name" in filteredAuthor && oldName && oldName !== "")jsPsychMetadata.deleteAuthor(oldName);
        
        jsPsychMetadata.setAuthor(filteredAuthor); // else case error? -> this else shouldn't be reachable so not sure how to handle
        break;
      case 'variable':
        const variable = formData as VariableFormData;
        const filteredVariable = filterEmptyFields(variable) as VariableFields;

        if ("name" in filteredVariable && oldName && oldName !== "") jsPsychMetadata.deleteVariable(oldName);
          
        jsPsychMetadata.setVariable(filteredVariable); // else case error? -> this else shouldn't be reachable so not sure how to handle
        break;
      default: 
        console.warn("Submitting form returning with undefined type:", type);
        return;
    }

    updateMetadataString(); // calls update to the UI string and is broken
  }

  const renderPopup = () => {
    switch (popupType) {
      case 'list':
        return <ListPopup jsPsychMetadata={jsPsychMetadata} onClose={closePopup} setPopupType={setPopupType} setPopupData={setPopupData} updateMetadataString={updateMetadataString} />;
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
      <div className="optionsPage">
        <h1>Metadata Options</h1>
        <p>It is highly advised you enter author information and edit the title </p>
        <button className="optionsButton" onClick={() => openPopup('list')}>Edit existing field</button>
        <button className="optionsButton" onClick={() => openPopup('field')}>Add metadata field</button>
        <button className="optionsButton" onClick={() => jsPsychMetadata.localSave()}>Download</button>
        <button className="optionsButton" onClick={() => setPage('upload')}>Upload data</button>

        {isPopupOpen && renderPopup()}
      {/* <button onClick={() => console.log(jsPsychMetadata.getMetadata())}>print metadata</button> */}
      </div>
    </>
  );
};

export default Options;

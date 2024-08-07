import JsPsychMetadata, {AuthorFields, VariableFields } from '@jspsych/metadata';
import { useState } from 'react';
import FieldPopup, { FieldFormData } from './popups/FieldPopup';
import AuthorPopup, { AuthorFormData } from './popups/AuthorPopup';
import VariablePopup, { VariableFormData } from './popups/VariablePopup';
import ListPopup from '../components/popups/ListPopup';
import ListItems from './ListItems';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
  updateMetadataString: () => void;
} 

const Preview: React.FC<PreviewProps> = ( { jsPsychMetadata, updateMetadataString } ) => {
  const [ metadataObject, setMetadataObject ] = useState<{ [key: string]: any }>(jsPsychMetadata.getUserMetadataFields()); // fields
  const [ authorsList, setAuthorsList ] = useState(jsPsychMetadata.getAuthorList()); // authors
  const [ variablesList, setVariablesList ] = useState(jsPsychMetadata.getVariableList()); // variables

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

    // updateMetadataString(); // calls update to the UI string and is broken
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

  const updateState = () => {
    setMetadataObject(jsPsychMetadata.getUserMetadataFields());
    setAuthorsList(jsPsychMetadata.getAuthorList());
    setVariablesList(jsPsychMetadata.getVariableList());
  }

  const fields = () => {
    var res = "";

    for (const key in metadataObject){
      res += key + ": " + metadataObject[key] + "\n";
    }

    return res;
  }

  const authors = () => {
    var res = ""; 

    for (const key in authorsList){
      res += authorsList[key] + "\n";
    }

    return res;
  }

  // need to build out logic for how to increment thorugh these
  const variables = () => {
    var res = ""; 

    // likely go through the fields and pick some that we want, and others that don't want
    for (const key in variablesList){
      res += JSON.stringify(variablesList[key]) + "\n";
    }

    return res;
  }

  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <div>
        <h3>Fields</h3>
        <pre>
          {fields()}
        </pre>
        <h3>Authors</h3>
        <pre>
          {authors()}
        </pre>
        <h3>Variables</h3>
        <pre>
          {variables()}
        </pre>
        <ListItems jsPsychMetadata={jsPsychMetadata} setPopupData={setPopupData} setPopupType={setPopupType} updateMetadataString={updateMetadataString} openPopup={openPopup} closePopup={closePopup}/>
        {isPopupOpen && renderPopup()}
      </div>    
    </div>
  )
}

export default Preview;
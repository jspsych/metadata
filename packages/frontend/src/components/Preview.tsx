import JsPsychMetadata, {AuthorFields, VariableFields } from '@jspsych/metadata';
import { useState } from 'react';
import FieldPopup, { FieldFormData } from './popups/FieldPopup';
import AuthorPopup, { AuthorFormData } from './popups/AuthorPopup';
import VariablePopup, { VariableFormData } from './popups/VariablePopup';
import ListPopup from '../components/popups/ListPopup';
import ListItems from './ListItems';
import Plus from '../assets/plus.svg';

interface PreviewProps {
  jsPsychMetadata: JsPsychMetadata;
  metadataString: string;
  updateMetadataString: () => void;
} 

const Preview: React.FC<PreviewProps> = ( { jsPsychMetadata, updateMetadataString } ) => {
  const [ metadataFields, setMetadataFields ] = useState<{ [key: string]: any }>(jsPsychMetadata.getUserMetadataFields()); // fields
  const [ authorsList, setAuthorsList ] = useState({author: jsPsychMetadata.getAuthorList()}); // authors
  const [ variablesList, setVariablesList ] = useState({ variableMeasured: jsPsychMetadata.getVariableList()}); // variables

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

    updateState();
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
    const newMetadataFields = jsPsychMetadata.getUserMetadataFields();
    const newAuthorsList = { author: jsPsychMetadata.getAuthorList() };
    const newVariablesList = { variableMeasured: jsPsychMetadata.getVariableList() };

    if (JSON.stringify(metadataFields) !== JSON.stringify(newMetadataFields)) {
      console.log("stringify metadatadatafields");
      setMetadataFields(newMetadataFields);
    }
    if (JSON.stringify(authorsList) !== JSON.stringify(newAuthorsList)) {
      console.log("stringify author");

      setAuthorsList(newAuthorsList);
    }
    if (JSON.stringify(variablesList) !== JSON.stringify(newVariablesList)) {
      console.log("stringify var");

      setVariablesList(newVariablesList);
    }
  }

  return (
    <div className="App">
      <h2>Metadata preview</h2>
      <div>
        <div className='preview-header'>
          <h3>Fields</h3>
          <button className="previewButton" onClick={() => openPopup('field')}>
            <img src={Plus} alt="Trash" style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
        <pre>
          <ListItems jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} openPopup={openPopup} data={metadataFields}/>
        </pre>
        <div className='preview-header'>
          <h3>Authors</h3>
          <button className="previewButton" onClick={() => openPopup('author')}>
            <img src={Plus} alt="Trash" style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
        <pre>
          <ListItems jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} openPopup={openPopup} data={ authorsList }/>
        </pre>
        <div className='preview-header'>
          <h3>Variables</h3>
          <button className="previewButton" onClick={() => openPopup('variables')}>
            <img src={Plus} alt="Trash" style={{ width: '20px', height: '20px' }} />
          </button>
        </div>        <pre>
          <ListItems jsPsychMetadata={jsPsychMetadata} updateMetadataString={updateMetadataString} openPopup={openPopup} data={ variablesList }/>
        </pre>
        {isPopupOpen && renderPopup()}
      </div>    
    </div>
  )
}

export default Preview;
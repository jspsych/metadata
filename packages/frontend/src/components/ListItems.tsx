import JsPsychMetadata from '@jspsych/metadata';
import React, { useState } from 'react';
import Trash from '../assets/trash.svg'

type ListItemsProps = {
  jsPsychMetadata: JsPsychMetadata;
  setPopupType: (type: string) => void; // Update setPopupType to accept optional data
  setPopupData: (data: any) => void;
  updateMetadataString: () => void;
  openPopup: (type: string, data?: any) => void;
  closePopup: () => void; // shoudl be passed to the other item
} 

type Author = {
  /** The type of the author. */
  "@type"?: string;
  /** The name of the author. (required) */
  name: string;
  /** The given name of the author. */
  givenName?: string;
  /** The family name of the author. */
  familyName?: string;
  /** The identifier that distinguishes the author across datasets (URL). */
  identifier?: string;
}

type VariableMeasured = {
  "@type": string;
  name: string; // required
  description: string | Record<string, string>;
  value: string | boolean | number;
  identifier?: string; // identifier that distinguishes across dataset (URL)
  minValue?: number;
  maxValue?: number;
  levels?: string[]; // array of string values
  levelsOrdered?: boolean;
  na?: boolean;
  naValue?: string;
  alternateName?: string;
  privacy?: string;
}

type Metadata = {
  name: string;
  schemaVersion: string;
  "@context": string;
  "@type": string;
  description: string;
  author: Author[];
  variableMeasured: VariableMeasured[];
  [key: string]: any;
}

const ListItems: React.FC<ListItemsProps> = ({ jsPsychMetadata, setPopupType, setPopupData, updateMetadataString, openPopup, closePopup }) => {
  const generateButtons = (metadata: Metadata) => {
    const res = [];
    for (const key in metadata) {
      const value = metadata[key];

      if (key === "variableMeasured"){
        for (const variable_key in value){
          const variable = value[variable_key];

          res.push(
            <div key={"variable" + variable_key} className="variable-item">
              <button onClick={() => { 
                openPopup("variables", variable);
              }}>            
                <span style={{ color: 'gray' }}>[Variable] </span> 
                <span >{variable["name"]}</span>              
              </button>
              <button 
                onClick={() => handleDelete(variable["name"], 'variable')}
                className="delete-button"
              >
                <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' } } />
              </button>
            </div>
          );
        }
      } else if (key === "author"){
        for (const author_key in value){
          const author = value[author_key];
          let author_typing: {};
          if (typeof author === "string") author_typing = { "name": author }; // fix name only issues
 
          res.push(
            <div key={"author" + author_key} className="author-item">
              <button onClick={() => { 
                openPopup("author", author_typing);
              }}>            
                <span style={{ color: 'gray' }}>[Author] </span> 
                <span>{author["name"]}</span>                  
              </button>
              <button 
                onClick={() => handleDelete(author["name"], 'author')}
                className="delete-button"
              >
                <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' } } />
              </button>
            </div>
          );
        }
      } else {
        res.push(
          <div key={"field" + key} className="field-item">
            <button onClick={() => {
              openPopup("field", { fieldName: key, fieldDescription: value });
            }}>            
              <span style={{ color: 'gray' }}>[{key}] </span> 
              <span>{value}</span>    
            </button>
            <button 
                onClick={() => handleDelete(key, 'field')}
                className="delete-button"
              >
                <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' } } />
              </button>
          </div>
        );
      }
    }

    return res;
  } 

  const [buttons, setbuttons] = useState(generateButtons(jsPsychMetadata.getMetadata() as Metadata));

  const handleDelete = (name: string, type: string) => {
    switch (type) {
      case 'variable':
        jsPsychMetadata.deleteVariable(name);
        break;
      case 'author':
        jsPsychMetadata.deleteAuthor(name);
        break
      case 'field':
        jsPsychMetadata.deleteMetadataField(name);
        break
    }

    // updates the UI -> need update String
    setbuttons(generateButtons(jsPsychMetadata.getMetadata() as Metadata)); 
    updateMetadataString();
  }


  return (
    <div className="list-item-container">
      <div className="list-items-content">
        <p>This is the listeItems page</p>
        <div className="button-container">
          {buttons}
        </div>
      </div>
    </div>
  )
}

export default ListItems;

import JsPsychMetadata from '@jspsych/metadata';
import React from 'react';

type ListPopup = {
  jsPsychMetadata: JsPsychMetadata;
  onClose: () => void;
  setPopupType: (type: string) => void; // Update setPopupType to accept optional data
  setPopupData: (data: any) => void;
  updateMetadataString: () => void;
  openPopup: (type: string, data?: any) => void;
  data?: Record<string, any>;
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

const ListPopup: React.FC<ListPopup> = ({ jsPsychMetadata, onClose, data, openPopup }) => { 
  
  const generateButtons = (metadata: Metadata) => {
    const res = [];
    for (const key in metadata) {
      const value = metadata[key];

      if (key === "variableMeasured") {
        for (const variable_key in value) {
          const variable = value[variable_key];

          res.push(
            <div key={"variable" + variable_key} className="variable-item">
              <button onClick={() => openPopup("variables", variable)}>            
                <span style={{ color: 'gray' }}>[Variable] </span> 
                <span>{variable.name}</span>              
              </button>
            </div>
          );
        }
      } else if (key === "author") {
        for (const author_key in value) {
          const author = value[author_key];
          const author_typing = typeof author === "string" ? { name: author } : author;

          res.push(
            <div key={"author" + author_key} className="author-item">
              <button onClick={() => openPopup("author", author_typing)}>            
                <span style={{ color: 'gray' }}>[Author] </span> 
                <span>{author_typing.name}</span>                  
              </button>
            </div>
          );
        }
      } else {
        res.push(
          <div key={"field" + key} className="field-item">
            <button onClick={() => openPopup("field", { fieldName: key, fieldDescription: value })}>            
              <span style={{ color: 'gray' }}>[{key}] </span> 
              <span>{value}</span>    
            </button>
          </div>
        );
      }
    }

    return res;
  } 


  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <p>These are fields commonly added to Psych-DS metadata to describe datasets. Clicking on them will allow you to fill in variable information.</p>
        <button className="close-button" onClick={onClose}>X</button>
        <div className="button-container">
          {data ? generateButtons(data as Metadata) : generateButtons(jsPsychMetadata.getMetadata() as Metadata)} 
        </div>
      </div>
    </div>
  )
}

export default ListPopup;

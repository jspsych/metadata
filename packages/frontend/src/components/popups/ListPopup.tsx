import JsPsychMetadata from '@jspsych/metadata';
import React, { useState } from 'react';
import Trash from '../../assets/trash.svg'

type ListPopup = {
  jsPsychMetadata: JsPsychMetadata;
  onClose: () => void;
  setPopupType: (type: string) => void; // Update setPopupType to accept optional data
  setPopupData: (data: any) => void;
  updateMetadataString: () => void;
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

const ListPopup: React.FC<ListPopup> = ({ jsPsychMetadata, onClose, setPopupType, setPopupData, updateMetadataString, data }) => { 
  
  const generateButtons = (metadata: Metadata) => {
    const res = [];
    for (const key in metadata) {
      const value = metadata[key];

      res.push(
        <div key={"field" + key} className="field-item">
          <button onClick={() => { 
            setPopupType('field');
            setPopupData({ fieldName: key, fieldDescription: value });
          }}>            
            <span style={{ color: 'gray' }}>[{key}] </span> 
            <span>{value}</span>    
          </button>
        </div>
      );
    }

    return res;
  } 


  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <p>This is the listPopup page</p>
        <button className="close-button" onClick={onClose}>X</button>
        <div className="button-container">
          {data ? generateButtons(data as Metadata) : generateButtons(jsPsychMetadata.getMetadata() as Metadata)} 
        </div>
      </div>
    </div>
  )
}

export default ListPopup;

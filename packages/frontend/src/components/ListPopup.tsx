import React, { useState } from 'react';

type ListPopup = {
  onClose: () => void;
  metadata: Metadata;
  currentPopup: string;
  setPopupType: (type: string, data?: any) => void; // Update setPopupType to accept optional data
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


const ListPopup: React.FC<ListPopup> = ( { onClose, metadata, currentPopup, setPopupType } ) => { 
  const generateButtons = (metadata: Metadata) => {
    const res = [];
    for (const key in metadata) {
      const value = metadata[key];

      if (key === "variableMeasured"){

      } else if (key === "author"){
        console.log("authors");
        // <button onClick={() => setPopupType('author')}>Add Author</button>
      } else {
        res.push(
          <button key={key} onClick={() => setPopupType('field', { key, value })}>
            {key}: {value}
          </button>
        );}
    }

    return res;
  } 

  const buttons = generateButtons(metadata);

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <p>this is the listPopup page</p>
        <button className="close-button" onClick={onClose}>X</button>
        <div className="button-container">
          {buttons}
        </div>
      </div>
    </div>
  )
}

export default ListPopup;
import JsPsychMetadata from '@jspsych/metadata';
import React, { useState } from 'react';
import Trash from '../assets/trash.svg';
import UpArrow from '../assets/uparrow.svg';
import DownArrow from '../assets/downarrow.svg';

type ListItemsProps = {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
  openPopup: (type: string, data?: any) => void;
  data: Record<string, any>;
  updateState: () => void;
}

type Author = {
  "@type"?: string;
  name: string;
  givenName?: string;
  familyName?: string;
  identifier?: string;
}

type VariableMeasured = {
  "@type": string;
  name: string;
  description: string | Record<string, string>;
  value: string | boolean | number;
  identifier?: string;
  minValue?: number;
  maxValue?: number;
  levels?: string[];
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

const ListItems: React.FC<ListItemsProps> = ({ jsPsychMetadata, updateMetadataString, openPopup, data, updateState }) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (itemKey: string) => {
    setExpandedItems((prevExpandedItems) =>
      prevExpandedItems.includes(itemKey)
        ? prevExpandedItems.filter((key) => key !== itemKey)
        : [...prevExpandedItems, itemKey]
    );
  };

  const generateButtons = (metadata: Metadata) => {
    const res = [];
    for (const key in metadata) {
      const value = metadata[key];

      if (key === "variableMeasured") {
        for (const variable_key in value) {
          const variable = value[variable_key];
          const isExpanded = expandedItems.includes("variable" + variable_key);

          res.push(
            <div
              key={"variable" + variable_key}
              className="variable-item-hover-popup"
              style={{
                paddingLeft: isExpanded ? '10px' : '0px', // Adjust padding as needed
                paddingRight: isExpanded ? '10px' : '0px' // Adjust padding as needed
              }}
            >
              <div className='hover-popup-title-container'>
                <button className="expand-button" onClick={() => toggleExpand("variable" + variable_key)}>
                  {isExpanded ? <img src={UpArrow} alt="Expand" /> : <img src={DownArrow} alt="Collapse" />}
                </button>
                <button onClick={() => openPopup("variables", variable)}>
                  <span>{variable.name}</span>
                </button>
                <button onClick={() => handleDelete(variable.name, 'variable')} className="delete-button-hover">
                  <img src={Trash} alt="Trash" />
                </button>
              </div>

              {isExpanded && (
                <div className="hover-popup">
                  <p>{typeof variable.description === 'object' ? JSON.stringify(variable.description, null, 2) : variable.description}</p>
                  {Object.entries(variable).map(([key, value]) => {
                    if (key === 'description' || value === '' || value === null || value === undefined || key === "@type" || key === "name") return null;

                    const displayValue = (typeof value === 'object' || typeof value === 'function')
                      ? JSON.stringify(value, null, 2)
                      : String(value);

                    return (
                      <p key={key}>
                        <strong>{key}:</strong> {displayValue}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
      } else if (key === "author") {
        for (const author_key in value) {
          const author = value[author_key];
          const author_typing = typeof author === "string" ? { name: author } : author;
          const isExpanded = expandedItems.includes("author" + author_key);

          res.push(
            <div key={"author" + author_key} className="author-item-hover-popup"
              style={{
                paddingLeft: isExpanded ? '10px' : '0px', // Adjust padding as needed
                paddingRight: isExpanded ? '10px' : '0px' // Adjust padding as needed
              }}>
              <div className='hover-popup-title-container'>
                <button className="expand-button" onClick={() => toggleExpand("author" + author_key)}>
                  {isExpanded ? <img src={UpArrow} alt="Expand"/> : <img src={DownArrow} alt="Collapse" />}
                </button>
                <button onClick={() => openPopup("author", author_typing)}>
                  <span>{author_typing.name}</span>
                </button>
                <button onClick={() => handleDelete(author_typing.name, 'author')} className="delete-button-hover">
                  <img src={Trash} alt="Trash" />
                </button>
              </div>
              {isExpanded && (
                  <div className="hover-popup">
                    {Object.entries(author_typing).map(([key, value]) => {
                      if (value === '' || value === null || value === undefined || key === "name") return null;

                      const displayValue = (typeof value === 'object' || typeof value === 'function')
                        ? JSON.stringify(value, null, 2)
                        : String(value);

                      return (
                        <p key={key}>
                          <strong>{key}:</strong> {displayValue}
                        </p>
                      );
                    })}
                  </div>
                )}
            </div>
          );
        }
      } else {
        const isExpanded = expandedItems.includes("field" + key);

        res.push(
          <div key={"field" + key} className="field-item-hover-popup"
            style={{
              paddingLeft: isExpanded ? '10px' : '0px', // Adjust padding as needed
              paddingRight: isExpanded ? '10px' : '0px' // Adjust padding as needed
            }}>
            <div className='hover-popup-title-container'>
              <button className="expand-button" onClick={() => toggleExpand("field" + key)}>
                {isExpanded ? <img src={UpArrow} alt="Expand"/> : <img src={DownArrow} alt="Collapse" />}
              </button>
              <button onClick={() => openPopup("field", { fieldName: key, fieldDescription: value })}>
                <span>{key}</span>
              </button>
              <button onClick={() => handleDelete(key, 'field')} className="delete-button-hover">
                <img src={Trash} alt="Trash" />
              </button>
            </div>
          {isExpanded && (
              <div className="hover-popup">
                <p>{value}</p>
                {/* Add more information as needed */}
              </div>
            )}
          </div>
        );
      }
    }

    return res;
  };

  const handleDelete = (name: string, type: string) => {
    switch (type) {
      case 'variable':
        jsPsychMetadata.deleteVariable(name);
        break;
      case 'author':
        jsPsychMetadata.deleteAuthor(name);
        break;
      case 'field':
        jsPsychMetadata.deleteMetadataField(name);
        break;
      default:
        console.warn('Unhandled type for deletion:', type);
    }

    updateState();
    updateMetadataString();
  };

  return (
    <div className="list-item-container">
      <div className="list-items-content">
        <div className="button-container">
          {generateButtons(data as Metadata)}
        </div>
      </div>
    </div>
  );
};

export default ListItems;
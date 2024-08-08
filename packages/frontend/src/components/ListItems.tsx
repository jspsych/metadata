import JsPsychMetadata from '@jspsych/metadata';
import React from 'react';
import Trash from '../assets/trash.svg';

// hover and adding more automatic options

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
              <button 
                onClick={() => handleDelete(variable.name, 'variable')}
                className="delete-button"
              >
                <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' }} />
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
              <button 
                onClick={() => handleDelete(author_typing.name, 'author')}
                className="delete-button"
              >
                <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' }} />
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
            <button 
              onClick={() => handleDelete(key, 'field')}
              className="delete-button"
            >
              <img src={Trash} alt="Trash" style={{ width: '20px', height: '20px' }} />
            </button>
          </div>
        );
      }
    }

    return res;
  }

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
  }

  return (
    <div className="list-item-container">
      <div className="list-items-content">
        <div className="button-container">
          {generateButtons(data as Metadata)}
        </div>
      </div>
    </div>
  );
}

export default ListItems;
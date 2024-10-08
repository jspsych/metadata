import { useState } from 'react';
import JsPsychMetadata from '@jspsych/metadata';

type VariablePopup = {
  jsPsychMetadata: JsPsychMetadata; // maybe unnecesssary
  onClose: () => void;
  onSave: (formData: VariableFormData, type: string, oldName?: string) => void;
  currentPopup: string;
  setPopupType: (type: string) => void;
  popupData: any;
}

export type VariableFormData = {
  "@type": string;
  name: string; // required
  description: string; // Record<string, string>; figure out how to include descriptions later
  value: string; // string, boolean, or number
  identifier: string; // identifier that distinguish across dataset (URL), confusing should check description
  minValue: number | undefined;
  maxValue: number | undefined;
  levels: string[] | [] | string; // string because of form data 
  levelsOrdered: boolean | undefined;
  na: boolean | undefined;
  naValue: string;
  alternateName: string;
  privacy: string;
}

const VariablePopup: React.FC<VariablePopup> = ( { onClose, onSave, currentPopup, setPopupType, popupData }) => {
  const [oldName] = useState(popupData["name"]) || "";

  const [formData, setFormData] = useState<VariableFormData>({
    "@type": popupData["@type"] || "",
    name: popupData["name"] || "", // required
    description: (typeof popupData["description"] === 'object'? JSON.stringify(popupData["description"], null, 2): popupData["description"]) || "",
    value: popupData["value"] ||  "", // string, boolean, or number
    identifier: popupData["identifier"] || "", // identifier that distinguish across dataset (URL), confusing should check description
    minValue: popupData["minValue"] || undefined,
    maxValue: popupData["maxValue"] || undefined,
    levels: popupData["levels"] || [],
    levelsOrdered: popupData["levelsOrdered"] || undefined,
    na: popupData["na"] || undefined,
    naValue: popupData["naValue"] || "",
    alternateName: popupData["alternateName"] || "",
    privacy: popupData["privacy"] || "",
  });

  const [nameError, setNameError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: (name === 'minValue' || name === 'maxValue') ? (value === "" ? undefined : Number(value)) : value
    }));
  };

  const handleBooleanChange = (name: keyof VariableFormData, value: boolean | undefined) => {
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    if (!formData.name) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError(null);
    }

    if (valid) {
      if (oldName !== "" && oldName !== formData["name"]) onSave(formData, 'variable', oldName);
      else onSave(formData, 'variable');
      
      onClose();
    }
  };

  return (
    <div className="popup-overlay">
      <div className="popup-content">
        <div>
          <button className={currentPopup === 'field' ? 'activePopup' : ''} onClick={() => setPopupType('field')}>Add Field</button>
          <button className={currentPopup === 'author' ? 'activePopup' : ''} onClick={() => setPopupType('author')}>Add Author</button>
          <button className={currentPopup === 'variables' ? 'activePopup' : ''} onClick={() => setPopupType('variables')}>Add Variables</button>
        </div>
        <button className="close-button" onClick={onClose}>X</button>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="@type">@type </label>
            <input
              type="text"
              id="@type"
              name="@type"
              value={formData["@type"]}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="name">name <span style={{ color: 'red' }}>*</span></label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />
            {nameError && <div style={{ color: 'red' }}>{nameError}</div>}
          </div>
          <div>
            <label htmlFor="description">description </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={8} // Adjust the number of rows as needed
              cols={60} // Adjust the number of columns as needed
            />
          </div>
          <div>
            <label htmlFor="value">value </label>
            <select
              id="value"
              name="value"
              value={formData.value}
              onChange={handleChange}
            >
              <option value="">Select a value</option>
              <option value="Boolean">Boolean</option>
              <option value="String">String</option>
              <option value="Number">Number</option>
              <option value="Object">Object</option>
            </select>
          </div>
          <div>
            <label htmlFor="identifier">identifier </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              value={formData.identifier}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="minValue">minValue </label>
            <input
              type="number"
              id="minValue"
              name="minValue"
              value={formData.minValue}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="maxValue">maxValue </label>
            <input
              type="number"
              id="maxValue"
              name="maxValue"
              value={formData.maxValue}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="levels">levels </label>
            <textarea
              id="levels"
              name="levels"
              value={formData.levels}
              onChange={handleChange}
              rows={8} // Adjust the number of rows as needed
              cols={60} // Adjust the number of columns as needed
            />
          </div>          
          <div>
            <label>Levels Ordered: </label>
            <div>
              <label>
                <input
                  type="radio"
                  name="levelsOrdered"
                  checked={formData.levelsOrdered === undefined}
                  onChange={() => handleBooleanChange('levelsOrdered', undefined)}
                />
                No Value
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="levelsOrdered"
                  checked={formData.levelsOrdered === true}
                  onChange={() => handleBooleanChange('levelsOrdered', true)}
                />
                True
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="levelsOrdered"
                  checked={formData.levelsOrdered === false}
                  onChange={() => handleBooleanChange('levelsOrdered', false)}
                />
                False
              </label>
            </div>
          </div>
          <div>
            <label>NA values?</label>
            <div>
              <label>
                <input
                  type="radio"
                  name="na"
                  checked={formData.na === undefined}
                  onChange={() => handleBooleanChange('na', undefined)}
                />
                No Value
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="na"
                  checked={formData.na === true}
                  onChange={() => handleBooleanChange('na', true)}
                />
                True
              </label>
            </div>
            <div>
              <label>
                <input
                  type="radio"
                  name="na"
                  checked={formData.na === false}
                  onChange={() => handleBooleanChange('na', false)}
                />
                False
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="naValue">naValue </label>
            <input
              type="text"
              id="naValue"
              name="naValue"
              value={formData.naValue}
              onChange={handleChange}
            />
          </div>          
          <div>
            <label htmlFor="alternateName">alternateName </label>
            <input
              type="text"
              id="alternateName"
              name="alternateName"
              value={formData.alternateName}
              onChange={handleChange}
            />
          </div>          
          <div>
            <label htmlFor="privacy">privacy </label>
            <input
              type="text"
              id="privacy"
              name="privacy"
              value={formData.privacy}
              onChange={handleChange}
            />
          </div>
          <button className='popup-submit' type="submit">Save</button>
        </form>
      </div>
    </div>
  )


}

export default VariablePopup;
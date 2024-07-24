import JsPsychMetadata from 'metadata';
import { useState } from 'react';

type AuthorPopup = {
  jsPsychMetadata: JsPsychMetadata; // maybe unnecessary
  onClose: () => void,
  onSave: (formData: AuthorFormData) => void;
  currentPopup: string;
  setPopupType: (type: string) => void;
  popupData: any;
}

export type AuthorFormData = {
  "@type": string,
  name: "",
  givenName: string,
  familyName: string,
  identifier: string,
}

const AuthorPopup: React.FC<AuthorPopup> = ( { onClose, onSave, currentPopup, setPopupType, popupData } ) => {
  const [formData, setFormData] = useState<AuthorFormData>({
    "@type": popupData["@type"] || "",
    name: popupData["name"] || "",
    givenName: popupData["givenName"] || "",
    familyName: popupData["familyName"] || "",
    identifier: popupData["identifier"] || "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState, 
      [name]: value
    }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  }

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
            <label htmlFor="@type">@type</label>
            <input
              type="text"
              id="@type"
              name="@type"
              value={formData["@type"]}
              onChange={handleChange}
            />
          </div>          
          <div>
            <label htmlFor="name">name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData["name"]}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="givenName">givenName</label>
            <input
              type="text"
              id="givenName"
              name="givenName"
              value={formData["givenName"]}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="familyName">familyName</label>
            <input
              type="text"
              id="familyName"
              name="familyName"
              value={formData["familyName"]}
              onChange={handleChange}
            />
          </div>
          <div>
            <label htmlFor="identifier">identifier</label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              value={formData["identifier"]}
              onChange={handleChange}
            />
          </div>
          <button type="submit">Save</button>
        </form>
      </div>
    </div>
  )
}

export default AuthorPopup;
import { useState } from 'react';

type AuthorPopup = {
  onClose: () => void,
  onSave: (formData: AuthorFormData) => void;
}

export type AuthorFormData = {
  "@type": string,
  givenName: string,
  familyName: string,
  identifier: string,
}

const AuthorPopup: React.FC<AuthorPopup> = ( { onClose, onSave } ) => {
  const [formData, setFormData] = useState<AuthorFormData>({
    "@type": "",
    givenName: "",
    familyName: "",
    identifier: "",
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
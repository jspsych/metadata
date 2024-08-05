import { useState } from 'react';
import { AuthorFields } from '../../../../metadata/dist/AuthorsMap';
import JsPsychMetadata from '@jspsych/metadata';

interface AuthorFormProps {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
  handleScreenChange: (newPage?: string, newButtonText?: string) => void;
}

// need to rework the save button to be built natively similar to the prompt form so that can handleSave with the state data
const AuthorForm: React.FC<AuthorFormProps> = ({ jsPsychMetadata, updateMetadataString, handleScreenChange }) => {
  const [authors, setAuthors] = useState<(AuthorFields)[]>(
    jsPsychMetadata.getAuthorList().map((author: AuthorFields | string) => {
      if (typeof author === 'string') {
        return { name: author, identifier: '', oldName: author }; // need to check oldName with saving
      } else {
        return { ...author, identifier: '', oldName: author["name"] }; // need to check oldName when saving
      }
    })
  );

  if (authors.length === 0) setAuthors([{ name: "", identifier: "" }]); // begins with empty field

  const handleNameChange = (index: number, value: string) => {
    const newAuthors = [...authors];
    newAuthors[index].name = value;
    setAuthors(newAuthors);
  };

  const handleIdentifierChange = (index: number, value: string) => {
    const newAuthors = [...authors];
    newAuthors[index].identifier = value;
    setAuthors(newAuthors);
  };

  const addEmptyAuthor = () => {
    setAuthors([...authors, { name: '', identifier: '' }]);
  };


  const handleSubmit = () => {
    for (const author of authors) {
        console.log("handling author:", author);

        const name = author['name'];
        const identifier = author['identifier'];
        const oldName: string = ("oldName" in author) ? author["oldName"] as string: "";
        const existed = ("oldName" in author);

        if (name === "") continue; // skip if no name

        if (!existed) { // no old name means can just add the two new fields
            if (identifier === "") {
                jsPsychMetadata.setAuthor({ "name": name });
            } else {
                jsPsychMetadata.setAuthor({ "name": name, "identifier": identifier });
            }
        } else { 
            // cleaning up old fields
            const authorWithIndex = author as AuthorFields & Record<string, unknown>; // typecasting
            for (const key in authorWithIndex) { 
              if (authorWithIndex[key] === "" || key === "oldName") {
                delete authorWithIndex[key];
              }
            }

            if (oldName !== name) {
              jsPsychMetadata.deleteAuthor(oldName); // weird type casting where just for this need to break
            }

            jsPsychMetadata.setAuthor(authorWithIndex);
        }
    }

    handleScreenChange('data', 'skip');
    updateMetadataString();
  }

  return (
    <div>
      <h2>Authors</h2>
      <p>The name field is required and any author missing the name field will not be added. This can be edited and authors can be added later.</p>
      {authors.map((author, index) => (
        <div key={index}>
          <label>
            Name: <span style={{ color: 'red' }}>*</span>
            <input
              type="text"
              value={author.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
            />
          </label>
          <label>
            Identifier:
            <input
              type="text"
              value={author.identifier}
              onChange={(e) => handleIdentifierChange(index, e.target.value)}
            />
          </label>
        </div>
      ))}
      <button onClick={() => {
        console.log(authors);
        addEmptyAuthor();
      }}>Add Author</button>
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
};

export default AuthorForm;
import { useState } from 'react';
import { AuthorFields } from '../../../../metadata/dist/AuthorsMap';
import JsPsychMetadata from 'metadata';

interface AuthorFormProps {
  jsPsychMetadata: JsPsychMetadata;
}

/// need to rework the testing button to make it add another name and identifier field
// need to rework the save button to be built natively similar to the prompt form so that can handleSave with the state data
const AuthorForm: React.FC<AuthorFormProps> = ({ jsPsychMetadata }) => {
  const [authors, setAuthors] = useState<(AuthorFields)[]>(
    jsPsychMetadata.getAuthorList().map((author: AuthorFields | string) => {
      if (typeof author === 'string') {
        return { name: author, identifier: '' };
      } else {
        return author;
      }
    })
  );

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

  return (
    <div>
      <h2>Authors</h2>
      {authors.map((author, index) => (
        <div key={index}>
          <label>
            Name:
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
      <button onClick={() => console.log(authors)}>testing</button>
    </div>
  );
};

export default AuthorForm;
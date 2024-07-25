import JsPsychMetadata from 'metadata';
import React, { useState, useRef, useEffect } from 'react';

type UploadDataProps = {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
};

type FileData = {
  name: string;
  content: string;
  fileType: string;
  filePath: string;
};

const UploadData: React.FC<UploadDataProps> = ({ jsPsychMetadata, updateMetadataString }) => {
  const [ fileList, setFileList ] = useState<File[]>([]);
  const [ filesRead, setFilesRead ] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFileList([...event.target.files]);
    }
  };

  const readFile = (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const fileType = file.name.split('.').pop()?.toLowerCase() || '';
      const filePath = (file as any).webkitRelativePath || file.name;

      if (fileType !== 'csv' && fileType !== 'json') {
        reject(new Error(`Unsupported file type: ${fileType}`));
        return;
      }

      reader.onload = () => {
        const textContent = reader.result as string; // Get the text content.
        resolve({ name: file.name, content: textContent, fileType, filePath }); // Resolve the promise with the file content, name, type, and path.
      };

      reader.onerror = reject; // Reject the promise on error.

      reader.readAsText(file); // Read the file as text.
    });
  };

  const processFiles = async (files: File[]): Promise<FileData[]> => {
    const filePromises = files.map(readFile);
    return Promise.all(filePromises);
  };

  const loadFiles = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    try {
      const fileDataArray = await processFiles(fileList);
  
      // Process each file data asynchronously
      for (const { name, content, fileType, filePath } of fileDataArray) {
        console.log(`File: ${name}, Type: ${fileType}, Path: ${filePath}`); //, Content: ${content}
        let screenName = "n/a"; // used to print but give useful information

        try {
          if (name === "dataset_description.json"){ 
            screenName = name + " [skipped, please upload below]";
            setFilesRead(prevFilesRead => [...prevFilesRead, screenName]);
            continue;
          }
          else if (fileType === "json") {
            await jsPsychMetadata.generate(content); // Use the text content with jsPsychMetadata.
            screenName = name + " [success]";
          } else if (fileType === 'csv') {
            await jsPsychMetadata.generate(content, {}, "csv");
            screenName = name + " [success]";
          } else {
            screenName = name + "[skipped, unsupported fileType]";
            console.warn("Unsupported file type:", fileType, "for filePath", filePath);
          }
        } catch (generateError) {
          screenName = name + "[failed with error: " + generateError, "]";
          console.error(`Error processing file ${name}:`, generateError);
        }

        setFilesRead(prevFilesRead => [...prevFilesRead, screenName]);
      }
    } catch (error) {
      console.error("Error reading files:", error);
    }

    updateMetadataString();
  };
  
  useEffect(() => {
    if (inputRef.current) {
      (inputRef.current as HTMLInputElement).webkitdirectory = true;
    }
  }, []);

  // const generate = () => {
  //   for (const file of fileList) {
  //     console.log(file);
  //   }

  //   console.log(jsPsychMetadata.getMetadata());
  // };

  return (
    <div className="uploadDataPage">
      <h2>Data file upload</h2>
      <p>
        You should upload the data folder, rather than the files individually and click 
        upload when you are for them to be processed. 
      </p>
      <p>
        If you are uploading a large number of files this may take longer. 
      </p>
      <form onSubmit={loadFiles}>
        <input
          type="file"
          multiple
          onChange={handleFileUpload}
          ref={inputRef}
        />
        <button type="submit">Upload</button>
      </form>
      <ul className="uploadDataFiles">
        {filesRead.map((file, index) => (
          <li className="uploadDataFileItem" key={index}>{file}</li>
        ))}
      </ul>
      {/* <button onClick={generate}>file info for debugging</button> */}
    </div>
  );
}

export default UploadData;
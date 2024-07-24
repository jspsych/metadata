import JsPsychMetadata from 'metadata';
import React, { useState, useRef, useEffect } from 'react';

type UploadDataProps = {
  setData: (data: FileData[]) => void;
  setFinalMetadata: (metadata: string) => void;
  jsPsychMetadata: JsPsychMetadata;
};

type FileData = {
  name: string;
  content: string;
  fileType: string;
  filePath: string;
};

export default function UploadData({ setData, setFinalMetadata, jsPsychMetadata }: UploadDataProps) {
  const [fileList, setFileList] = useState<File[]>([]);
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
      setData(fileDataArray); // Update the state with the new array.
  
      // Process each file data asynchronously
      for (const { name, content, fileType, filePath } of fileDataArray) {
        console.log(`File: ${name}, Type: ${fileType}, Path: ${filePath}, Content: ${content}`);
        
        try {
          if (name === "dataset_description.json") continue;
          else if (fileType === "json") {
            await jsPsychMetadata.generate(content); // Use the text content with jsPsychMetadata.
          } else if (fileType === 'csv') {
            await jsPsychMetadata.generate(content, {}, "csv");
          } else {
            console.warn("Unsupported file type:", fileType, "for filePath", filePath);
          }
        } catch (generateError) {
          console.error(`Error processing file ${name}:`, generateError);
        }
      }
    } catch (error) {
      console.error("Error reading files:", error);
    }
  };
  
  useEffect(() => {
    if (inputRef.current) {
      (inputRef.current as HTMLInputElement).webkitdirectory = true;
    }
  }, []);

  const generate = () => {
    for (const file of fileList) {
      console.log(file);
    }
  };

  return (
    <div className="App">
      <h2>Data file upload</h2>
      <form onSubmit={loadFiles}>
        <input
          type="file"
          multiple
          onChange={handleFileUpload}
          ref={inputRef}
        />
        <button type="submit">Upload</button>
      </form>
      <button onClick={generate}>Generate</button>
    </div>
  );
}

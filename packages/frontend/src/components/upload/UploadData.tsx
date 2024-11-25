import JsPsychMetadata from '@jspsych/metadata';
import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

type UploadDataProps = {
  jsPsychMetadata: JsPsychMetadata;
  updateMetadataString: () => void;
  handleScreenChange: (newPage?: string, newButtonText?: string) => void;
};

type FileData = {
  name: string;
  content: string;
  fileType: string;
  filePath: string;
};



const UploadData: React.FC<UploadDataProps> = ({ jsPsychMetadata, updateMetadataString, handleScreenChange }) => {
  const [ fileList, setFileList ] = useState<File[]>([]);
  const [ filesReadStatus, setFilesReadStatus ] = useState<string[]>([]);
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

      // choosing to throw errors later to work with flow of error checking
      // if (fileType !== 'csv' && fileType !== 'json') {
      //   reject(new Error(`Unsupported file type: ${fileType}`));
      //   return;
      // }

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
      createDirectoryAndZip(fileDataArray);
  
      // Process each file data asynchronously
      for (const { name, content, fileType, filePath } of fileDataArray) {
        const tempMessage = name + "...loading";
        setFilesReadStatus(prevFilesRead => [...prevFilesRead, tempMessage]);

        let screenName = "n/a";
        try {
          if (name === "dataset_description.json"){ 
            // await jsPsychMetadata.generate(content); // load above
            screenName = name + " [skipped, please during the previous Metadata prompt.]";
          }
          else if (fileType === "json") {
            await jsPsychMetadata.generate(content); // Use the text content with jsPsychMetadata.
            screenName = name + " ✔";
          } else if (fileType === 'csv') {
            await jsPsychMetadata.generate(content, {}, "csv");
            screenName = name + " ✔";
          } else {
            screenName = name + "[skipped, unsupported filetype for jsPsych data]";
            console.warn("Unsupported file type:", fileType, "for filePath", filePath);
          }
        } catch (generateError) {
          screenName = name + "[failed with error: " + generateError, "]";
          console.error(`Error processing file ${name}:`, generateError);
        }

        setFilesReadStatus(prevFilesRead => [...prevFilesRead.slice(0, -1), screenName]);
      }
    } catch (error) {
      console.error("Error reading files:", error);
    }

    handleScreenChange(undefined, "View metadata");
    updateMetadataString(); 
  };
  
  useEffect(() => {
    if (inputRef.current) {
      (inputRef.current as HTMLInputElement).webkitdirectory = true;
    }
  }, []);

  const createDirectoryAndZip = async (fileDataArray: FileData[]) => {
    const zip = new JSZip();

      // Create subdirectory
      const folder = zip.folder('organized_files');

      // Add uploaded files
      fileDataArray.forEach(({ name, content }) => {
        if (folder) folder.file(name, content);
      });

      // Create additional JSON files
      if (folder) folder.file('metadata.json', JSON.stringify({ created: new Date().toISOString() }));

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Download the zip file
      saveAs(zipBlob, 'data_files.zip');
  };

  const handleZipAndDownload = async () => {
      const fileDataArray = await processFiles(fileList); // Use your existing logic
      createDirectoryAndZip(fileDataArray);
  };

  return (
    <div className="uploadDataPage">
      <h2>Data file upload</h2>
      <p>
        You should upload the data folder, rather than the files individually and click 
        upload when you are for them to be processed. 
      </p>
      <p>
        You may upload as many files as you want.
      </p>
      {/* <form onSubmit={handleZipAndDownload}> */}
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
        {filesReadStatus.map((file, index) => (
          <li className="uploadDataFileItem" key={index}>{file}</li>
        ))}
      </ul>
    </div>
  );
}

export default UploadData;
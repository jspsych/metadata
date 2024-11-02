import fs from 'fs';
import path from 'path';
import { expandHomeDir } from './utils.js';


// creates directory structure for the Psych-Ds format allowing future functions to write data to here
export function createDirectoryWithStructure(directoryPath: string): void {
  const expandedPath = expandHomeDir(directoryPath); // accounting for ~ home directory

  const structure = {
    'data': {
    },
    'README.md': 
      `# My Project
      Human-readable description of the project and dataset.`,
    'CHANGES.md': 'For version tracking - if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.',
    'documentation': {}, // recommended directory
    'materials' : {}, // recommended directory
    'results': {},  // recommended directory
    'analysis': {}, // recommended directory
  }; 

  // Create the directory
  fs.mkdirSync(expandedPath, { recursive: true });

  // Iterate over the structure object
  for (const [fileName, content] of Object.entries(structure)) {
    const filePath = path.join(expandedPath, fileName);

    if (typeof content === 'string') {
      // Write the file with the provided content
      fs.writeFileSync(filePath, content);
    } else {
      // Create subdirectories and files
      fs.mkdirSync(filePath);
      for (const [subFileName, subContent] of Object.entries(content)) {
        const subFilePath = path.join(filePath, subFileName);
        fs.writeFileSync(subFilePath, subContent);
      }
    }
  }
}

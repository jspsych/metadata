import fs from 'fs';
import path from 'path';
import os from 'os';
// import { expandHomeDir } from './utils';

export function expandHomeDir(directoryPath: string): string {
  if (directoryPath.startsWith('~')) {
    const homeDir = os.homedir();
    return path.join(homeDir, directoryPath.slice(1));
  }
  return directoryPath;
}

export function createDirectoryWithStructure(directoryPath: string): void {
  // Expand '~' to the full home directory path
  const expandedPath = expandHomeDir(directoryPath);

  const structure = {
    'data': {
    },
    'README.md': 
      `# My Project
      Human-readable description of the project and dataset.`,
    'CHANGES.md': 'For version tracking - if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.',
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

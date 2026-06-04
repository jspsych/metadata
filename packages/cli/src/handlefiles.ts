import fs from 'fs';
import path from 'path';
import { expandHomeDir } from './utils';

// A nestable description of files (string content) and directories (nested objects).
interface DirStructure {
  [name: string]: string | DirStructure;
}

// creates directory structure for the Psych-Ds format allowing future functions to write data to here
export function createDirectoryWithStructure(directoryPath: string): void {
  const expandedPath = expandHomeDir(directoryPath); // accounting for ~ home directory

  const structure: DirStructure = {
    'data': {
      'raw': {},
    },
    'README.md':
      `# My Project\nHuman-readable description of the project and dataset.`,
    'CHANGES.md': 'For version tracking - if the dataset is updated after being uploaded/shared, changes (with human-readable descriptions) may be recorded here.',
  };

  const writeStructure = (basePath: string, struct: DirStructure): void => {
    fs.mkdirSync(basePath, { recursive: true });

    for (const [name, content] of Object.entries(struct)) {
      const targetPath = path.join(basePath, name);
      if (typeof content === 'string') {
        fs.writeFileSync(targetPath, content);
      } else {
        writeStructure(targetPath, content); // nested object → directory
      }
    }
  };

  writeStructure(expandedPath, structure);
}

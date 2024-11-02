import os from 'os';
import path from 'path';
import fs from "fs";

export function expandHomeDir(directoryPath: string): string {
  if (directoryPath.startsWith('~')) {
    const homeDir = os.homedir();
    return path.join(homeDir, directoryPath.slice(1));
  }
  return directoryPath;
}

export async function printDirectoryStructure(dirPath, indent = '') {
  const entries = await fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    console.log(`${indent}${entry.isDirectory() ? '📁' : '📄'} ${entry.name}`);

    if (entry.isDirectory()) {
      await printDirectoryStructure(fullPath, indent + '  ');
    }
  }
}
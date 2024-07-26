import fs from "fs";
import path from "path";
import os from 'os';

// creating path
export const generatePath = (inputPath) => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.resolve(process.cwd(), inputPath);
  }
};

// processing single file, need to refactor this into a seperate call
const processFile = async (metadata, directoryPath, file) => {
  const filePath = path.join(directoryPath, file);
  console.log("Reading file:", filePath);

  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const fileExtension = path.extname(file).toLowerCase();

    switch (fileExtension){
      case '.json':
        if (file === "dataset_description.json") metadata.loadMetadata(content); // need to remove this for the files that are being called with the CLI
        else await metadata.generate(content);
        break;
      case '.csv':
        await metadata.generate(content, {}, 'csv');
        break;
      default:
        console.error("File is not .csv or .json", file);
    }
  } catch (err) {
    console.error(`Error reading file ${file}:`, err);
  }
}

// Processing directory recursively up to one level
export const processDirectory = async (metadata, directoryPath) => {
  const processDirectoryRecursive = async (currentPath, level) => {
    if (level > 1){ 
      console.warn("Can only read subdirectories one level deep:", directoryPath);
      return;
    }

    try {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

      // Sort files to process 'dataset_description.json' first
      items.sort((itemA, itemB) => {
        if (itemA.name === 'dataset_description.json') return -1;
        if (itemB.name === 'dataset_description.json') return 1;
        return 0;
      });

      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);
        if (item.isDirectory()) {
          await processDirectoryRecursive(itemPath, level + 1);
        } else {
          await processFile(metadata, currentPath, item.name);
        }
      }

      return true; // might not work when doesn't have a csv/json
    } catch (err) {
      console.error(`Error reading directory ${currentPath}:`, err);
      return false;
    }
  };

  return await processDirectoryRecursive(directoryPath, 0);
};


// Processing metadata options json
export const processOptions = async (metadata, filePath) => {
  try {
    const metadata_options_path = generatePath(filePath);
    const data = fs.readFileSync(metadata_options_path, "utf8"); // synchronous read

    console.log("\nmetadata options:", data, "\n"); // log the raw data
    var metadata_options = JSON.parse(data); // parse the JSON data
    
    metadata.updateMetadata(metadata_options);
    return true;
  } catch (error) {
    console.error("Error reading or parsing metadata options:", error);
    return false;
  }
}

// Saving data
export function saveTextToFile(textstr, filename, directory = '.') {
  const filePath = path.join(directory, filename);

  fs.writeFile(filePath, textstr, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing to file ${filePath}:`, err);
    } else {
      console.log(`File ${filePath} has been saved.`);
    }
  });
}

// in case path goes to file already
export function saveTextToPath(textstr, filePath = './file.txt') {
  fs.writeFile(filePath, textstr, 'utf8', (err) => {
    if (err) {
      console.error(`Error writing to file ${filePath}:`, err);
    } else {
      console.log(`File ${filePath} has been saved.`);
    }
  });
}


// function for loading metadata
export const loadMetadata = async (metadata, filePath) => {
  const fileName = path.basename(filePath).toLowerCase(); // Extract the file name from the filePath

  try {
    const content = await fs.promises.readFile(filePath, "utf8");

    if (fileName === "dataset_description.json"){
      metadata.loadMetadata(content); 
      console.log("\nContents of dataset_description.json:\n", content)
      return true;
    }
    else console.error("dataset_description.json is not found at path:", filePath);
  } catch (err) {
    console.error(`Error reading file ${fileName}:`, err);
  }

  return false;
}

// Function to expand ~ to the user's home directory
const expandHomeDir = (filePath: string): string => {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
};

// Validating if input is a directory
export const validateDirectory = async (filePath: string): Promise<boolean> => {
  try {
    // Expand ~ to the user's home directory
    const expandedPath = expandHomeDir(filePath);

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);
    const stats = await fs.promises.stat(resolvedPath);

    if (!stats.isDirectory()) {
      console.error(`Error: ${resolvedPath} is not a directory`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

// Validating if input is a json file 
export const validateJson = (filePath: string, fileName?: string): boolean => {
  try {
    // Expand ~ to the user's home directory
    const expandedPath = expandHomeDir(filePath);

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);

    if (fileName && path.basename(resolvedPath).toLowerCase() !== fileName.toLowerCase()) {
      console.error("File name does not match:", fileName);
      return false;
    }

    // Check if the file has a .json extension
    if (path.extname(resolvedPath).toLowerCase() !== '.json') {
      console.error(`Error: ${resolvedPath} is not a JSON file`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}
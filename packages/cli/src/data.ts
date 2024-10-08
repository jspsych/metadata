import fs from "fs";
import path from "path";
import { expandHomeDir } from "./utils.js";

// creating path -> handles the absolute vs non-absolute paths
export const generatePath = (inputPath) => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.resolve(process.cwd(), inputPath);
  }
};

const copyFileWithStructure = async (sourceFilePath, verbose, targetDirectoryPath) => {
  try {
    sourceFilePath = expandHomeDir(sourceFilePath);
    targetDirectoryPath = expandHomeDir(targetDirectoryPath);

    const relativePath = path.relative(path.dirname(sourceFilePath), sourceFilePath);
    const targetFilePath = path.join(targetDirectoryPath, relativePath);

    // Ensure the target directory exists
    const targetDir = path.dirname(targetFilePath);
    await fs.promises.mkdir(targetDir, { recursive: true });

    // Copy the file
    await fs.promises.copyFile(sourceFilePath, targetFilePath);
    if (verbose) console.log(`File copied from ${sourceFilePath} to ${targetFilePath}`);
  } catch (error) {
    console.error(`Failed to copy file from ${sourceFilePath} to ${targetDirectoryPath}:`, error);
  }
};

// processing single file, need to refactor this into a seperate call
const processFile = async (metadata, directoryPath, file, verbose, targetDirectoryPath?) => {
  const filePath = path.join(directoryPath, file);
  if (verbose) console.log("Reading file:", filePath); 

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
        console.error(`"${file}" is not .csv or .json format.`);
        return false;
    }

    if (targetDirectoryPath) await copyFileWithStructure(filePath, verbose, targetDirectoryPath); // error catching to create backwards compability with CLI and old cli prompting
  } catch (err) {
    console.error(`Error reading file ${file}: ${err} Please ensure this is data generated by JsPsych.`);
    return false;
  }

  return true;
}

// Processing directory recursively up to one level
export const processDirectory = async (metadata, directoryPath, verbose=false, targetDirectoryPath?) => {
  directoryPath = expandHomeDir(directoryPath);
  let total = 0;
  let failed = 0;

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
          total += 1;
          if (!await processFile(metadata, currentPath, item.name, verbose, targetDirectoryPath)) failed += 1; // returns false if failed
        }
      }

      return true; // might not work when doesn't have a csv/json
    } catch (err) {
      console.error(`Error reading directory ${currentPath}:`, err);
      failed += 1;    }
  };

  await processDirectoryRecursive(directoryPath, 0);

  if (failed === 0) console.log(`✔ Reading data files was successful with ${total} files read.`);
  else if (failed !== total) console.log(`? Data files was partially successful with ${(total - failed)}/${total} files read.`);
  else if (failed === total) console.log(`x Data files was unsuccessful with 0 files read. Please try again with valid JsPsych generated data.`);

  return { total, failed };
};

// Processing metadata options json
export const processOptions = async (metadata, filePath, verbose=false) => {
  try {
    const metadata_options_path = expandHomeDir(generatePath(filePath));
    const data = fs.readFileSync(metadata_options_path, "utf8"); // synchronous read

    if (verbose) console.log("\nmetadata options:", data, "\n"); // log the raw data
    var metadata_options = JSON.parse(data); // parse the JSON data
    
    metadata.updateMetadata(metadata_options);
    console.log(`\n✔ Successfully read and updated metadata according to options file.`);
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
  filePath = expandHomeDir(filePath);

  fs.writeFile(filePath, textstr, 'utf8', (err) => {
    if (err) {
      console.error(`\nError writing to file ${filePath}:`, err);
    } else {
      console.log(`\n✔ File ${filePath} has been saved.`);
    }
  });
}

// function for loading metadata
export const loadMetadata = async (metadata, filePath) => {
  filePath = expandHomeDir(filePath);
  const fileName = path.basename(filePath).toLowerCase(); // Extract the file name from the filePath

  try {
    const content = await fs.promises.readFile(filePath, "utf8");

    if (fileName === "dataset_description.json"){
      metadata.loadMetadata(content);
      console.log(`\n✔ Successfully loaded previous metadata.\n`);
      return true;
    }
    else console.error("dataset_description.json is not found at path:", filePath);
  } catch (err) {
    console.error(`Error reading file ${fileName}:`, err);
  }

  return false;
}



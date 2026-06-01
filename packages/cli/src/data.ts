import fs from "fs";
import path from "path";
import JsPsychMetadata, { analyzeJoinKeys, JoinKeyAnalysis, parseCSV } from "@jspsych/metadata";
import { expandHomeDir, deriveArrayFilename, objectsToCSV } from "./utils";

export interface GenerateOptions {
  arrayJoinKeys?: string[];
  suppressJoinKeyWarning?: boolean;
}

/**
 * Reads all data files (JSON or CSV, not dataset_description.json) from a directory,
 * runs a join-key uniqueness analysis on each, and returns the worst-case result
 * (file with the highest duplicateCount). Returns null if no suitable file is found
 * or all files are unique (preserving the caller's "all good" fast path).
 */
export async function preAnalyzeDirectory(
  directoryPath: string,
  initialKeys: string[] = ['trial_index']
): Promise<{ parsedData: Array<Record<string, any>>; analysis: JoinKeyAnalysis; fileName: string } | null> {
  directoryPath = expandHomeDir(directoryPath);

  let items: fs.Dirent[];
  try {
    items = await fs.promises.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return null;
  }

  let worst: { parsedData: Array<Record<string, any>>; analysis: JoinKeyAnalysis; fileName: string } | null = null;

  // Collect all candidate file paths at the top level and one subdirectory deep,
  // matching the traversal depth of processDirectory.
  const filePaths: Array<{ filePath: string; name: string }> = [];
  for (const item of items) {
    if (item.isDirectory()) {
      try {
        const subItems = await fs.promises.readdir(path.join(directoryPath, item.name), { withFileTypes: true });
        for (const subItem of subItems) {
          if (!subItem.isDirectory()) {
            filePaths.push({ filePath: path.join(directoryPath, item.name, subItem.name), name: subItem.name });
          }
        }
      } catch { continue; }
    } else {
      filePaths.push({ filePath: path.join(directoryPath, item.name), name: item.name });
    }
  }

  for (const { filePath, name } of filePaths) {
    if (name === 'dataset_description.json') continue;

    const ext = path.extname(name).toLowerCase();
    if (ext !== '.json' && ext !== '.csv') continue;

    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      let parsedData: Array<Record<string, any>>;

      if (ext === '.json') {
        const raw = JSON.parse(content);
        if (!Array.isArray(raw)) continue;
        parsedData = raw as Array<Record<string, any>>;
      } else {
        parsedData = (await parseCSV(content)) as Array<Record<string, any>>;
      }

      const analysis = analyzeJoinKeys(parsedData, initialKeys);
      if (!analysis.isUnique && (worst === null || analysis.duplicateCount > worst.analysis.duplicateCount)) {
        worst = { parsedData, analysis, fileName: name };
      }
    } catch {
      continue;
    }
  }

  return worst;
}

// creating path -> handles the absolute vs non-absolute paths
export const generatePath = (inputPath: string): string => {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  } else {
    return path.resolve(process.cwd(), inputPath);
  }
};

const copyFileWithStructure = async (sourceFilePath: string, verbose: boolean, targetDirectoryPath: string) => {
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
const processFile = async (metadata: JsPsychMetadata, directoryPath: string, file: string, verbose: boolean, targetDirectoryPath?: string, options: GenerateOptions = {}) => {
  const filePath = path.join(directoryPath, file);
  if (verbose) console.log("Reading file:", filePath);

  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const fileExtension = path.extname(file).toLowerCase();

    switch (fileExtension){
      case '.json':
        if (file === "dataset_description.json") metadata.loadMetadata(content); // need to remove this for the files that are being called with the CLI
        else await metadata.generate(content, {}, 'json', options);
        break;
      case '.csv':
        await metadata.generate(content, {}, 'csv', options);
        break;
      default:
        console.error(`"${file}" is not .csv or .json format.`);
        return false;
    }

    if (targetDirectoryPath) {
      await copyFileWithStructure(filePath, verbose, targetDirectoryPath);

      // dataset_description.json takes the loadMetadata() branch above, which does not
      // reset extractedArrays. Without this guard we would re-write the previous data
      // file's array rows under a filename derived from "dataset_description.json".
      if (file === "dataset_description.json") return true;

      // Write a separate Psych-DS CSV for each array-of-objects column detected during generate()
      const extractedArrays = metadata.getExtractedArrays();
      const joinKeys = metadata.getArrayJoinKeys();
      const priorityCols = [...joinKeys, 'element_index'];
      for (const [colName, rows] of extractedArrays) {
        const outFilename = deriveArrayFilename(file, colName);
        const outPath = path.join(targetDirectoryPath, outFilename);
        await fs.promises.writeFile(outPath, objectsToCSV(rows, priorityCols), 'utf8');
        if (verbose) console.log(`  → wrote array data for "${colName}" to ${outPath}`);
      }
    }
  } catch (err) {
    console.error(`Error reading file ${file}: ${err} Please ensure this is data generated by JsPsych.`);
    return false;
  }

  return true;
}

// Processing directory recursively up to one level
export const processDirectory = async (metadata: JsPsychMetadata, directoryPath: string, verbose: boolean = false, targetDirectoryPath?: string, options: GenerateOptions = {}) => {
  directoryPath = expandHomeDir(directoryPath);
  let total = 0;
  let failed = 0;

  const processDirectoryRecursive = async (currentPath: string, level: number) => {
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
          if (!await processFile(metadata, currentPath, item.name, verbose, targetDirectoryPath, options)) failed += 1; // returns false if failed
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
export const processOptions = async (metadata: JsPsychMetadata, filePath: string, verbose: boolean = false) => {
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

export function saveTextToPath(textstr: string, filePath: string = './file.txt') {
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
export const loadMetadata = async (metadata: JsPsychMetadata, filePath: string) => {
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



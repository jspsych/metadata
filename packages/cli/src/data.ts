// import JsPsychMetadata from "../dist/index.js";
import fs from "fs";
import path from "path";

// processing single file
const processFile = async (metadata, directoryPath, file) => {
  const filePath = path.join(directoryPath, file);

  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    const fileExtension = path.extname(file).toLowerCase();

    switch (fileExtension){
      case '.json':
        if (file === "dataset_description.json") metadata.loadMetadata(content); // this does not do that good of a job because it doesn't do this first -- so therefore might not work as intended
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

// Loading the data for generating metadata
export const processDirectory = async (metadata, directoryPath) => {
  try {
    const files = await fs.promises.readdir(directoryPath);

    // Sort files to process 'dataset_description.json' first
    files.sort((fileA, fileB) => {
      if (fileA === 'dataset_description.json') return -1;
      if (fileB === 'dataset_description.json') return 1;
      return 0;
    });

    for (const file of files) {
      await processFile(metadata, directoryPath, file);
    }
  } catch (err) {
    console.error("Error reading directory:", err);
  }
};

// Processing metadata options json
export const processOptions = async (metadata, filePath) => {
  try {
    const metadata_options_path = path.resolve(process.cwd(), filePath);
    const data = fs.readFileSync(metadata_options_path, "utf8"); // synchronous read

    console.log("\nmetadata options:", data, "\n"); // log the raw data
    var metadata_options = JSON.parse(data); // parse the JSON data
    
    metadata.updateMetadata(metadata_options);
  } catch (error) {
    console.error("Error reading or parsing metadata options:", error);
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
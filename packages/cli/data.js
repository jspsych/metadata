// import JsPsychMetadata from "../dist/index.js";
import fs from "fs";
import path from "path";

// Loading the data for generating metadata
export const processData = async (metadata, directoryPath) => {
  try {
    const files = await fs.promises.readdir(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);

      try {
        const data = await fs.promises.readFile(filePath, "utf8");
        await metadata.generate(data);
      } catch (err) {
        console.error(`Error reading file ${file}:`, err);
      }
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

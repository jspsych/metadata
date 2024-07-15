import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToFile, generatePath } from "./data.js";

const metadata = new JsPsychMetadata();

if (!process.argv[2]) {
  console.error("Providing the path is a required argument");
  process.exit(1);
}
const dataPath = generatePath(process.argv[2]);

// Processes the different arguments
const update = async () => {
  await processDirectory(metadata, dataPath);

  if (process.argv[3]){ // only call if pass in metadata options
    processOptions(metadata, process.argv[3]);
  }
}

// figuring out the logic on how to save the data and how shoudl dicate hwo to write hte method to save it 
const onFinish = () => {
  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  console.log(metadataString); // Pretty print with 2 spaces for indentation
  saveTextToFile(metadataString, "dataset_description.json", dataPath);
}

async function main() {
  await update();
  onFinish();
}

main();
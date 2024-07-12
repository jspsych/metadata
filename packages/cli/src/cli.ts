import path from "path";

import JsPsychMetadata from "../../metadata-package/src/index.js";
import { processDirectory, processOptions } from "./data.js";

const metadata = new JsPsychMetadata();

// Path to the directory files, need to work in absolute paths as well
const dataRelativePath = process.argv[2];
if (!process.argv[2]) {
  console.error("Providing the path is a required argument");
  process.exit(1);
}
const dataPath = path.resolve(process.cwd(), dataRelativePath);

// Processes the different arguments
const update = async () => {
  await processDirectory(metadata, dataPath);

  if (process.argv[3]){ // only call if pass in metadata options
    processOptions(metadata, process.argv[3]);
  }
}

// figuring out the logic on how to save the data and how shoudl dicate hwo to write hte method to save it 
const onFinish = () => {
  console.log(metadata.getMetadata());
}


async function main() {
  await update();
  // onFinish();
}

main();
// add another to pass in existing metadata and add more dataa
  // will probably want to make a CLI to interface in case want to use an old interface
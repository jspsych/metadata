import { input } from '@inquirer/prompts';

import JsPsychMetadata from "metadata";

const metadata = new JsPsychMetadata();

async function main() {
  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  console.log(metadataString); // Pretty print with 2 spaces for indentation
}

main();

// const answer = await input({ message: 'Enter your name' });
// console.log("answer:", answer);
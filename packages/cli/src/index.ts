import { input, select, confirm } from '@inquirer/prompts';
import inquirer from 'inquirer';
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import fs from 'fs';
import path from 'path';
import JsPsychMetadata from "metadata";

const metadata = new JsPsychMetadata();

import fuzzy from 'fuzzy';

// async function main() {
//   const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
//   console.log(metadataString); // Pretty print with 2 spaces for indentation
// }

// main();

async function dataPath(){

}

async function metadataOptions(){
  const optionsPath = await input({
    message: "Enter the path to the metadata.options file:"
  });

  console.log(optionsPath);
}

metadataOptions();


// async function promptEmail() {
//   const emailAnswer = await input({
//     message: 'Enter your email address:',
//     validate: (input) => {
//       if (/\S+@\S+\.\S+/.test(input)) {
//         return true;
//       }
//       return 'Please enter a valid email address.';
//     },
//   });

//   console.log(`Your email address is ${emailAnswer}.`);
// }

// // promptEmail();

// async function main() {
//   try {
//     const nameAnswer = await input({
//       message: 'Enter your name:',
//     });

//     // Call a function here
//     await someFunction();

//     const proceedAnswer = await confirm({
//       message: `Hello, ${nameAnswer}! Do you want to proceed?`,
//     });

//     if (proceedAnswer) {
//       console.log(`Great! Let's proceed, ${nameAnswer}.`);
//       // Call another function or perform additional prompts here
//     } else {
//       console.log(`Okay, ${nameAnswer}. Maybe next time.`);
//     }
//   } catch (error) {
//     console.error('Error during prompt:', error);
//   }
// }

// async function someFunction() {
//   // Example of another async function call
//   console.log('Executing some function...');
// }

// main();
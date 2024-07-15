import { input, select, confirm } from '@inquirer/prompts';
import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToFile, generatePath } from "./data.js";

const metadata = new JsPsychMetadata();


// async function main() {
//   const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
//   console.log(metadataString); // Pretty print with 2 spaces for indentation
// }

// main();


async function dataPath(){

}

async function metadataOptions(){
  const optionsPath = await input({
    message: 'Enter the path to the metadata options file in json format:',
    validate: async (input) => {
      if (await processOptions(metadata, input)) return true;
      return "Please enter a valid path to a json file";
    }
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
import { input, select, confirm } from '@inquirer/prompts';
import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToFile, generatePath } from "./data.js";

const metadata = new JsPsychMetadata();

  // has it ask if would want to create the data -> take the answer and trigger logic
async function existingMetadata(){
  const answer = await select({
    message: 'How would you like to use the JSPsych metadata CLI?',
    choices: [
      {
        name: 'Generate new',
        value: 'generate',
        description: 'Given data files, can automatically download generate metadata file.',
      },
      {
        name: 'Edit existing',
        value: 'edit',
        description: 'Can edit existing metadata file and update using new data or specified options.',
      },
    ],
  });
}

await existingMetadata();

async function dataPathPrompt(){
  const dataPath = await input({
    message: 'Enter the path to the data directory:',
    validate: async (input) => {
      if (await processDirectory(metadata, input)) return true;
      return "Please enter a valid path to a valid directory";
    }
  });

  console.log(dataPath);
  return dataPath;
}

const dataPath = await dataPathPrompt();

async function metadataOptionsPrompt(){
  // have this first ask if want to customize using metadata options 
  const optionsPath = await input({
    message: 'Enter the path to the metadata options file in json format:',
    validate: async (input) => {
      if (await processOptions(metadata, input)) return true;
      return "Please enter a valid path to a json file";
    }
  });

  console.log(optionsPath);
  return optionsPath;
}

const optionsPath = await metadataOptionsPrompt();


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


// TODO -- have the very last call be the printing to terminal and have the saving()
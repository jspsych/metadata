import { input, select } from '@inquirer/prompts';
import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToFile, loadMetadata, saveTextToPath, validateDirectory, validateJson } from "./data.js";

// figure out how to make it -> check the validate and then see what happens
// -> refactor the method to first check if is a valid directory

async function existingMetadata(metadata){
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
  
  let oldData: string = "";

  try {
    switch(answer){
      case "generate":
        break;
      case "edit":
        oldData = await input({
          message: 'Enter the path to the existing dataset_description.json file:',
          validate: async (input) => {
            if (validateJson(input, "dataset_description.json")) return true;
            return "Please enter a valid path to a json file";
          }
        });     
        await loadMetadata(oldData, "dataset_description.json");
        break;
      default: 
        console.error("Existing metadata answer is not added/configured:", answer);
    }
  } catch (err){

  }

  return oldData;
}


async function dataPathPrompt(metadata){
  const dataPath = await input({
    message: 'Enter the path to the data directory:',
    validate: async (input) => {
      if (await validateDirectory(input)){ 
        return true;
      }
      return "Please enter a valid path to a valid directory";
    }
  });

  await processDirectory(metadata, dataPath);
  return dataPath;
}

async function metadataOptionsPrompt(metadata){
  const answer = await select({
    message: 'Would you like to customize the metadata by providing a .json specifying changes?',
    choices: [
      {
        name: 'Use default metadata',
        value: false,
        description: 'Can edit using text editor or rerun this CLI with a metadata options file.',
      },
      {
        name: 'Customize metadata',
        value: true,
        description: 'Should only customize if you have a prepared .json with format according to the Psych-DS and JsPsych metadata specifications.',
      },
    ],
  });

  var optionsPath: string = "";

  if (answer){
    optionsPath = await input({
      message: 'Enter the path to the metadata options file in json format:',
      validate: async (input) => {
        if (validateJson(input)) return true;
        return "Please enter a valid path to a json file";
      }
    });

    await processOptions(metadata, optionsPath);
  }

  return optionsPath;

}

const main = async() => {
  const metadata = new JsPsychMetadata();

  const oldData = await existingMetadata(metadata); // will want to write to this path when writing final json
  const dataPath = await dataPathPrompt(metadata);
  const optionsPath = await metadataOptionsPrompt(metadata);

  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  console.log(metadataString); // Pretty print with 2 spaces for indentation

  // saving to old Data file if provided, otherwise new data file
  if (oldData === "" || oldData === undefined || oldData === null){
    saveTextToFile(metadataString, "dataset_description.json", dataPath);
  }
  else{
    saveTextToPath(metadataString, oldData);
  }
}

await main();
import { input, select } from '@inquirer/prompts';
import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToFile, loadMetadata, saveTextToPath, validateDirectory, validateJson } from "./data.js";
import { } from './validateFunctions.js';

// Figure out what to do with processDirectory method
// -> do we leave it the same for the CLI no prompting ot work with overwriting and updating
// -> what to do with the path in the ClI prompting -- write to data directory or overwrite the other fiel
    // -> do we want to load data directory as well

async function existingMetadata(metadata){
  const answer = await select({
    message: 'Do you have an existing dataset_description.json file?',
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
  
  let dataset_description_path: string = "";

  try {
    switch(answer){
      case "generate":
        break;
      case "edit":
        dataset_description_path = await input({
          message: 'Enter the path to the existing dataset_description.json file:',
          validate: async (input) => {
            if (validateJson(input, "dataset_description.json")) return true;
            return "Please enter a valid path to a json file";
          }
        });     
        await loadMetadata(metadata, dataset_description_path);
        break;
      default: 
        console.error("Existing metadata answer is not added/configured:", answer);
    }
  } catch (err){ } // should be no errors

  return dataset_description_path;
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

// -------------------------------------> new code 
const generateProjectStructure = async () => {
  const answer = await select({
    message: 'Would you like to generate a new project directory or update an existing project directory?',
    choices: [
      {
        name: 'Generate new project',
        value: 'generate',
        description: 'Select if you have not generated a Psych-DS compliant project folder.',
      },
      {
        name: 'Update existing project',
        value: 'update',
        description: 'Selected if you want to update Psych-DS compliant project folder',
      },
    ],
  });

  let project_path: string = "";

  try {
    switch(answer){
      case "generate": // this doesn't have to be a directory 
        project_path = await input({
          message: 'Enter the folder you want to generate the data:',
          validate: async (input) => {  
            if (await validateDirectory(input)){  // not sure how to check this
              return true;
            }
            return "Please enter a valid path to a valid directory";
          }
        });
        break;
      case "update": // when this hapepns we will want to read the directory through the file system and need to figure out how to handle this case
        project_path = await input({
          message: 'Enter the path to the project directory:', // 
          validate: async (input) => {
            if (await validateDirectory(input)){  // and will need to check that contains dataset_description.json
              return true; 
              // read through the entire directory checking dataset_json (will assume it has already been made) -> only thing that is reallly important 
              // maybe call the validator function but will instead just write to this 
              // -> will not actually read, will assume there is a directory
            }
            return "Please enter a valid path to the project directory";
          }
        });
        break;
    }
  } catch (err){ } // should be no errors

  return project_path;
}

const promptName = async () => {
  const project_name = await input({
    message: 'What would you like to name the project?',
  });

  return project_name;
}



const main = async () => {
  const metadata = new JsPsychMetadata();

  const project_path = await generateProjectStructure();
  const project_name = await promptName();

  // can prompt an additional reading data -> keeps reading data until it is done and then writes it to the data_directory of the folder

  // allows for a metadata options file that will let you overwite the data by letting you write

  // eventually saves it -> with the logic of writing with the normal file and with all of it

  console.log("project_path:", project_path, "project_name:", project_name);
};

await main();

const archive_main = async() => {
  const metadata = new JsPsychMetadata();

  const dataset_description_path = await existingMetadata(metadata); // will want to write to this path when writing final json
  const dataPath = await dataPathPrompt(metadata);
  const optionsPath = await metadataOptionsPrompt(metadata);

  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  console.log(metadataString); // Pretty print with 2 spaces for indentation

  // saving to old Data file if provided, otherwise new data file
  if (dataset_description_path === "" || dataset_description_path === undefined || dataset_description_path === null){
    saveTextToFile(metadataString, "dataset_description.json", dataPath);
  }
  else{
    saveTextToPath(metadataString, dataset_description_path);
  }
}

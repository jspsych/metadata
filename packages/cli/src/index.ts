#!/usr/bin/env node

import { input, select } from '@inquirer/prompts';
import JsPsychMetadata from "metadata";
import { processDirectory, processOptions, saveTextToPath } from "./data.js";
import { validateDirectory, validateJson } from './validateFunctions.js';
import { createDirectoryWithStructure } from './handleFiles.js';

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
const promptProjectStructure = async () => {
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
        return [project_path, true];
      case "update": // when this hapepns we will want to read the directory through the file system and need to figure out how to handle this case
        project_path = await input({
          message: 'Enter the path to the project directory:', // 
          validate: async (input) => {
            if (await validateDirectory(input)){  // and will need to check that contains dataset_description.json -> validate that this is existing psych-DS dataset
              return true; 
              // read through the entire directory checking dataset_json (will assume it has already been made) -> only thing that is reallly important 
              // maybe call the validator function but will instead just write to this 
              // -> will not actually read, will assume there is a directory
            }
            return "Please enter a valid path to the project directory";
          }
        });
        return [project_path, false];
    }
  } catch (err){ } // should be no errors

  return project_path;
}

// should only do if generating 
const promptName = async () => {
  const project_name = await input({
    message: 'What would you like to name the project?',
  });

  return project_name;
}

const promptData = async (metadata, targetDirectoryPath) => {
  // can prompt an additional reading data -> keeps reading data until it is done and then writes it to the data_directory of the folder
  var data_path;
  
  data_path = await input({
    message: 'Please pass a path to the data directory?',
    validate: async (input) => {  
      if (await validateDirectory(input)){ 
        return true;
      }
      return "Please enter a valid path to a valid directory";
    }
  });

  await processDirectory(metadata, data_path, targetDirectoryPath); // will check if already existing metadata and won't need to prompt
}

const main = async () => {
  const metadata = new JsPsychMetadata();
  var [project_path, new_project] = await promptProjectStructure(); // -> if reading from existing will want to look for if dataset_description file exists

  if (new_project) {
    const project_name = await promptName();
    project_path = `${project_path}/${project_name}`;
    createDirectoryWithStructure(project_path);
  }

  await promptData(metadata, `${project_path}/data`); 
  
  await metadataOptionsPrompt(metadata); // passing in options file to overwite existing file

  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  console.log(metadataString); // Pretty print with 2 spaces for indentation
  saveTextToPath(metadataString,`${project_path}/dataset_description.json`);
};

await main();

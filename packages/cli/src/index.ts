#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { input, select } from '@inquirer/prompts';
import JsPsychMetadata from "@jspsych/metadata";
import { processDirectory, processOptions, saveTextToPath, loadMetadata } from "./data.js";
import { validateDirectory, validateJson, validatePsychDS } from './validatefunctions.js';
import { createDirectoryWithStructure } from './handlefiles.js';

// Define a type for the parsed arguments
interface Argv {
  verbose?: boolean;
  'psych-ds-dir'?: string;
  'data-dir'?: string;
  'metadata-options'?: string;
  _: (string | number)[];
  $0: string;
}

// Parse command-line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
  })
  .option('psych-ds-dir', {
    alias: 'em',
    type: 'string',
    description: 'Path to an existing Psych-DS directory.',
  })
  .option('data-dir', {
    alias: 'd',
    type: 'string',
    description: 'Path to a data-dir.',
  })
  .option('metadata-options', {
    alias: 'm',
    type: 'string',
    description: 'Path to a metadata-options.json file.',
  })
  .help()
  .argv as Argv;

async function metadataOptionsPrompt(metadata, verbose){
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

    await processOptions(metadata, optionsPath, verbose);
  }

  return optionsPath;

}

const promptProjectStructure = async (metadata) => {
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
            try {
              if (await validateDirectory(input) && await validateJson(input + "/dataset_description.json", "dataset_description.json")){  // and will need to check that contains dataset_description.json -> validate that this is existing psych-DS dataset, validateJson with inpput
                return true; 
              }
              return "Please enter a valid path to the project directory. Be sure it includes a dataset_description.json file in the root otherwise it will not work.";
            } catch (err) {
              console.error(err);
              return "Please enter a valid path to the project directory. Be sure it includes a dataset_description.json file in the root otherwise it will not work.";
            }
          }
        });

        await loadMetadata(metadata, project_path + "/dataset_description.json");

        return [project_path, false];
    }
  } catch (err){ } // should be no errors

  return project_path;
}

// should only do if generating 
const promptName = async () => {
  const project_name = await input({
    message: 'What would you like to name the project? This will be used for the metadata and to name the directory.',
  });

  return project_name;
}

const promptData = async (metadata, verbose, targetDirectoryPath) => {
  // can prompt an additional reading data -> keeps reading data until it is done and then writes it to the data_directory of the folder
  var data_path;
  
  data_path = await input({
    message: 'Please pass a path a data directory that has not been added to the metadata already. This should not already be in the project folder, and will be copied over when created.',
    validate: async (input) => {  
      if (await validateDirectory(input)){ 
        return true;
      }
      return "Please enter a valid path to a valid directory.";
    }
  });

  await processDirectory(metadata, data_path, verbose, targetDirectoryPath); // will check if already existing metadata and won't need to prompt
}

// can seperate the process argv's out into seperate function
const main = async () => {
  const verbose = argv.verbose ? argv.verbose : false;
  const metadata = new JsPsychMetadata(verbose);

  var project_path, new_project;

  if (argv['psych-ds-dir'] 
    && await validateDirectory(argv['psych-ds-dir']) 
    && await validateJson(argv['psych-ds-dir'] + "/dataset_description.json", "dataset_description.json")){  
      project_path = argv['psych-ds-dir'];
      new_project = false;
      await loadMetadata(metadata, project_path + "/dataset_description.json"); // maybe shoudl add verbose
      if (verbose) console.log(`\n\n-------------------------- Reading existing metadata --------------------------\n\n${JSON.stringify(metadata.getMetadata(), null, 2)}`);
  }
  else {
    [ project_path, new_project ] = await promptProjectStructure(metadata);
  }

  if (new_project) {
    const project_name = await promptName();
    project_path = `${project_path}/${project_name}`;
    createDirectoryWithStructure(project_path); // May want to include this with project_name therefore will prevent errors
    metadata.setMetadataField("name", project_name); // same as above
  }

  // check if it's a valid data directory and run it if it is possible
  if (argv['data-dir'] && await validateDirectory(argv['data-dir'])){
    if (verbose) console.log("\n\n-------------------------- Reading and writing data files --------------------------\n\n");
    await processDirectory(metadata, argv['data-dir'] , verbose, `${project_path}/data`); // will check if already existing metadata and won't need to prompt
  }
  else await promptData(metadata, verbose, `${project_path}/data`); 
  
  // check if it's a valid path and then prompt the options
  if (argv['metadata-options'] && validateJson(argv['metadata-options'])){
    if (verbose) console.log("\n\n-------------------------- Reading and writing metadata-option --------------------------n\n");
    await processOptions(metadata, argv['metadata-options'], verbose);
  }
  else await metadataOptionsPrompt(metadata, verbose); // passing in options file to overwite existing file
  
  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  if (argv.verbose) console.log("\n\n-------------------------- Final metadata string --------------------------\n\n", metadataString);
  await saveTextToPath(metadataString,`${project_path}/dataset_description.json`);

  // validate the output after saving the dataset_description
  await validatePsychDS(project_path, verbose);
};



main();

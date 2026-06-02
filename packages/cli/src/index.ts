#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { input, select, checkbox, Separator } from '@inquirer/prompts';
import JsPsychMetadata, { analyzeJoinKeys, JoinKeyAnalysis } from "@jspsych/metadata";
import { processDirectory, processOptions, saveTextToPath, loadMetadata, preAnalyzeDirectory } from "./data";
import { validateDirectory, validateJson, validatePsychDS } from './validatefunctions';
import { createDirectoryWithStructure } from './handlefiles';

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

/**
 * Interactively resolves which join-key columns should be used for extracted array CSVs.
 * Shows a categorised checkbox prompt when trial_index (or other initial keys) are not unique,
 * re-checks after each selection, and offers a "proceed anyway" escape.
 * Returns the final list of join-key column names.
 */
async function promptJoinKeys(
  parsedData: Array<Record<string, any>>,
  initialAnalysis: JoinKeyAnalysis,
  initialKeys: string[],
  fileName: string
): Promise<string[]> {
  let currentKeys = [...initialKeys];
  let analysis = initialAnalysis;

  while (!analysis.isUnique) {
    const keyLabel = currentKeys.join(', ');
    console.log(
      `\n⚠  [${keyLabel}] not unique in "${fileName}": ` +
      `${analysis.duplicateCount} duplicate row${analysis.duplicateCount === 1 ? '' : 's'} found.`
    );
    console.log('   Nested arrays need a unique row ID to be saved as separate CSV files.');
    if (analysis.duplicateValues.length > 0) {
      console.log(
        '   Example duplicates: ' +
        analysis.duplicateValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')
      );
    }
    if (analysis.suggestedAdditionalKeys && analysis.suggestedAdditionalKeys.length > 0) {
      console.log(`   Suggested addition: [${analysis.suggestedAdditionalKeys.join(', ')}]`);
    }

    if (analysis.candidates.length === 0) {
      console.log('   No candidate columns found — the data may contain genuinely duplicate rows.');
      break;
    }

    const sufficient = analysis.candidates.filter(c => c.makesUnique && c.column !== '__proceed__');
    const insufficient = analysis.candidates.filter(c => !c.makesUnique && c.column !== '__proceed__');

    type Choice = { name: string; value: string; checked: boolean };
    const choices: Array<Choice | Separator> = [];
    if (sufficient.length > 0) {
      choices.push(new Separator('── Sufficient alone ──'));
      for (const c of sufficient) {
        choices.push({ name: c.column, value: c.column, checked: true });
      }
    }
    if (insufficient.length > 0) {
      choices.push(new Separator('── Reduces duplicates ──'));
      for (const c of insufficient) {
        choices.push({ name: c.column, value: c.column, checked: false });
      }
    }
    choices.push(new Separator());
    choices.push({
      name: 'Proceed anyway (extracted CSVs may have duplicate rows)',
      value: '__proceed__',
      checked: false,
    });

    const selected: string[] = await checkbox({
      message: 'Select additional join-key columns for extracted array CSVs:',
      choices,
    });

    if (selected.includes('__proceed__')) break;

    const additionalKeys = selected.filter(s => s !== '__proceed__');
    if (additionalKeys.length === 0) {
      console.log('   No columns selected. Select at least one column or choose "Proceed anyway".');
      continue;
    }

    currentKeys = [...currentKeys, ...additionalKeys];
    analysis = analyzeJoinKeys(parsedData, currentKeys);

    if (analysis.isUnique) {
      console.log(`✔ [${currentKeys.join(', ')}] uniquely identifies all rows.`);
    }
  }

  return currentKeys;
}

async function metadataOptionsPrompt(metadata: JsPsychMetadata, verbose: boolean){
  const answer = await select({
    message: 'Would you like to customize the metadata?',
    choices: [
      {
        name: 'Use defaults',
        value: false,
        description: 'You can always edit dataset_description.json directly or re-run this CLI later.',
      },
      {
        name: 'Use a custom metadata file',
        value: true,
        description: 'Use a .json file that follows the Psych-DS and jsPsych metadata specifications to override generated metadata (authors, variable descriptions, etc.).',
      },
    ],
  });

  var optionsPath: string = "";

  if (answer){
    optionsPath = await input({
      message: 'Path to metadata options .json file:',
      validate: async (input) => {
        if (validateJson(input)) return true;
        return "File not found or not valid JSON — check the path and try again.";
      }
    });

    await processOptions(metadata, optionsPath, verbose);
  }

  return optionsPath;

}

const promptProjectStructure = async (metadata: JsPsychMetadata) => {
  const answer = await select({
    message: 'What would you like to do?',
    choices: [
      {
        name: 'Create a new project',
        value: 'generate',
        description: 'Create a Psych-DS project from your data.',
      },
      {
        name: 'Update an existing project',
        value: 'update',
        description: 'Refresh metadata for a previously generated Psych-DS project.',
      },
    ],
  });

  let project_path: string = "";

  try {
    switch(answer){
      case "generate":
        project_path = await input({
          message: 'Path to the folder where the new project will be created:',
          validate: async (input) => {
            if (await validateDirectory(input)) return true;
            return "Not a valid folder — check the path and try again.";
          }
        });
        return [project_path, true];
      case "update":
        project_path = await input({
          message: 'Path to existing project folder (must contain dataset_description.json):',
          validate: async (input) => {
            try {
              if (await validateDirectory(input) && await validateJson(input + "/dataset_description.json", "dataset_description.json")){
                return true;
              }
              return "This folder is not a valid Psych-DS project (dataset_description.json not found). Please enter the path to an existing Psych-DS project folder.";
            } catch (err) {
              console.error(err);
              return "This folder is not a valid Psych-DS project (dataset_description.json not found). Please enter the path to an existing Psych-DS project folder.";
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
    message: 'Enter the project name (used as the folder name and in the metadata):'
  });

  return project_name;
}

const promptDataDir = async (): Promise<string> => {
  return input({
    message: 'Path to your raw data folder (files will be copied, not moved):',
    validate: async (input) => {
      if (await validateDirectory(input)) return true;
      return "Not a valid folder — check the path and try again.";
    }
  });
}

const SYSTEM_VARIABLE_NAMES = new Set([
  "trial_type",
  "trial_index",
  "time_elapsed",
  "extension_type",
  "extension_version",
]);

function hasUnknownDescription(variable: any): boolean {
  const desc = variable["description"];
  if (!desc) return false;
  if (typeof desc === "string") return desc === "unknown";
  if (typeof desc === "object") {
    const values = Object.values(desc) as string[];
    return values.length > 0 && values.every((v) => v === "unknown");
  }
  return false;
}

const promptUnknownDescriptions = async (metadata: JsPsychMetadata) => {
  const unknownVars = metadata.getVariableNames().filter((name) => {
    if (SYSTEM_VARIABLE_NAMES.has(name)) return false;
    return hasUnknownDescription(metadata.getVariable(name));
  });

  if (unknownVars.length === 0) return;

  const fillIn = await select({
    message: `${unknownVars.length} variable(s) have unknown descriptions. Would you like to fill them in?`,
    choices: [
      {
        name: "Fill in descriptions",
        value: true,
        description: "You will be prompted for each variable. Press Enter to skip individual ones.",
      },
      {
        name: "Skip",
        value: false,
        description: "Leave descriptions as unknown in the dataset_description.json.",
      },
    ],
  });

  if (!fillIn) return;

  for (const name of unknownVars) {
    const description = await input({
      message: `Description for "${name}" (press Enter to skip):`,
    });

    if (description.trim()) {
      // updateVariable's "description" handling is append-only — it accumulates
      // descriptions across plugins rather than overwriting. Clear the existing
      // "unknown" entry first so the user's value replaces it instead of sitting
      // alongside the stale "unknown".
      const variable = metadata.getVariable(name) as { description?: Record<string, string> };
      variable.description = {};
      metadata.updateVariable(name, "description", { user: description.trim() });
    }
  }
};

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
      // project_path is argv['psych-ds-dir'] (a string) inside this branch — no typeof guard needed here.
      await validatePsychDS(project_path, verbose); // informational only — result not acted on here
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

  // Determine data directory path (from flag or interactive prompt)
  let dataDir: string;
  if (argv['data-dir'] && await validateDirectory(argv['data-dir'])) {
    dataDir = argv['data-dir'];
  } else {
    dataDir = await promptDataDir();
  }

  if (verbose) console.log("\n\n-------------------------- Reading and writing data files --------------------------\n\n");

  // Pre-flight: check whether default join key (trial_index) is unique; prompt if not
  const initialKeys = ['trial_index'];
  const preResult = await preAnalyzeDirectory(dataDir, initialKeys);
  let arrayJoinKeys = initialKeys;
  if (preResult && !preResult.analysis.isUnique) {
    arrayJoinKeys = await promptJoinKeys(preResult.parsedData, preResult.analysis, initialKeys, preResult.fileName);
  }

  // The pre-flight prompt above already surfaced any join-key uniqueness issue to the
  // user, so suppress the library's per-file warning to avoid repeating it.
  await processDirectory(metadata, dataDir, verbose, `${project_path}/data`, { arrayJoinKeys, suppressJoinKeyWarning: true });
  
  // check if it's a valid path and then prompt the options
  if (argv['metadata-options'] && validateJson(argv['metadata-options'])){
    if (verbose) console.log("\n\n-------------------------- Reading and writing metadata-option --------------------------n\n");
    await processOptions(metadata, argv['metadata-options'], verbose);
  }
  else await metadataOptionsPrompt(metadata, verbose); // passing in options file to overwite existing file
  
  const isNonInteractive = !!(
    argv['psych-ds-dir'] && await validateDirectory(argv['psych-ds-dir']) &&
    argv['data-dir'] && await validateDirectory(argv['data-dir']) &&
    argv['metadata-options'] && validateJson(argv['metadata-options'])
  );

  if (!isNonInteractive) await promptUnknownDescriptions(metadata);

  const metadataString = JSON.stringify(metadata.getMetadata(), null, 2); // Assuming getMetadata() is the function that retrieves your metadata
  if (argv.verbose) console.log("\n\n-------------------------- Final metadata string --------------------------\n\n", metadataString);
  await saveTextToPath(metadataString,`${project_path}/dataset_description.json`);

  if (typeof project_path === 'string') {
    const validation = await validatePsychDS(project_path, verbose);

    if (validation.missingRequiredFields.length > 0) {
      if (!isNonInteractive) {
        console.log('\nSome required fields are missing. Please provide values:');
        for (const field of validation.missingRequiredFields) {
          const value = await input({ message: `Value for required field "${field}":` });
          if (value.trim()) {
            metadata.setMetadataField(field, value.trim());
          } else {
            console.warn(`  Skipped "${field}" — this field is still required. Validation may still fail.`);
          }
        }
        const updatedMetadata = JSON.stringify(metadata.getMetadata(), null, 2);
        await saveTextToPath(updatedMetadata, `${project_path}/dataset_description.json`);
        const revalidation = await validatePsychDS(project_path, verbose);
        if (revalidation.hasErrors) process.exit(1);
        if (revalidation.missingRecommendedFields.length > 0) {
          console.log(`\nConsider adding these recommended fields to your metadata: ${revalidation.missingRecommendedFields.join(', ')}`);
        }
      } else {
        process.exit(1);
      }
    } else if (validation.hasErrors) {
      process.exit(1);
    } else if (validation.missingRecommendedFields.length > 0) {
      console.log(`\nConsider adding these recommended fields to your metadata: ${validation.missingRecommendedFields.join(', ')}`);
    }
  }
};

main();

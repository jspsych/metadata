import fs from "fs";
import path from "path";
import { expandHomeDir, printDirectoryStructure } from "./utils.js";
import { validate } from "psychds-validator";

export const validatePsychDS = async (path: string, verbose: boolean) => {
  await printDirectoryStructure(path); /// why is there error with metadata in wrong location

  const result = await validate(path);
  
  if (verbose) console.log("\n\ndataset has been validated:", result, "\n\n"); // might want to remove this

  await handlePsychDSValidate(result, verbose);
}

const handlePsychDSValidate = async (validationObject: any/*Promise<ValidationResult>*/, verbose: boolean) => {
  const warnings: any[] = [];
  const errors: any[] = [];

  // console.log(validationObject['issues']);
  for (const [key, issue] of (validationObject['issues'])) {
    if (issue.severity === 'warning') {
      // console.log("this is a warning:", issue, "\n")
      warnings.push(issue);
    }
    else if (issue.severity === 'error') {
      // console.log("this is an error:", issue, "\n"); 
      errors.push(issue);
    }
    // console.log("Issue Key:", key);, console.log("Severity:", issue.severity);, console.log("Reason:", issue.reason);, console.log("Files Affected:", issue.files);, console.log("Requires:", issue.requires);
  }

  // sum up errors and warnings and print necessary information below
  if (errors.length == 0){
    console.log(`✔ Dataset is Psych-DS compliant. Validation process finished with ${errors.length} errors and ${warnings.length} warnings.`);
  } {
    console.log(`x Dataset is not Psych-DS compliant. Validation process finished with ${errors.length} errors and ${warnings.length} warnings.\n\n`);

    for (const error of errors) {
      console.log(error.key, ":", error.reason);
    }
  }

  if (verbose) {
    console.log("this is running in verbose mode");
    // either print warnings, or print whole object
  }
}

// Validating if input is a directory
export const validateDirectory = async (filePath: string): Promise<boolean> => {
  try {
    const expandedPath = expandHomeDir(filePath); // allows for using "~" home directory

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);
    const stats = await fs.promises.stat(resolvedPath);

    if (!stats.isDirectory()) {
      console.error(`Error: ${resolvedPath} is not a directory`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

// Validating if input is a json file 
export const validateJson = (filePath: string, fileName?: string): boolean => {
  try {
    // Expand ~ to the user's home directory
    const expandedPath = expandHomeDir(filePath);

    // Resolve the full path to ensure it's an absolute path
    const resolvedPath = path.resolve(expandedPath);

    // Check if the file exists
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: File does not exist at path ${resolvedPath}`);
      return false;
    }

    if (fileName && path.basename(resolvedPath).toLowerCase() !== fileName.toLowerCase()) {
      console.error("File name does not match:", fileName);
      return false;
    }

    // Check if the file has a .json extension
    if (path.extname(resolvedPath).toLowerCase() !== '.json') {
      console.error(`Error: ${resolvedPath} is not a JSON file`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

import fs from "fs";
import path from "path";
import { expandHomeDir } from "./utils";
import { validate } from "psychds-validator";

export const validatePsychDS = async (datasetPath: string, verbose: boolean): Promise<void> => {
  let result;
  try {
    result = await validate(path.relative(process.cwd(), datasetPath));
  } catch (err) {
    console.warn(`\nWarning: Psych-DS validation could not run: ${err instanceof Error ? err.message : err}`);
    return;
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [, issue] of result.issues) {
    if (issue.severity === 'error') errors.push(`${issue.key}: ${issue.reason}`);
    else if (issue.severity === 'warning') warnings.push(`${issue.key}: ${issue.reason}`);
  }

  if (errors.length === 0) {
    console.log(`\n✔ Psych-DS validation passed (${warnings.length} warning${warnings.length !== 1 ? 's' : ''}).`);
  } else {
    console.error(`\n✘ Psych-DS validation failed: ${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}.\n`);
    errors.forEach((msg, i) => console.error(`  Error ${i + 1}: ${msg}`));
  }

  if (verbose && warnings.length > 0) {
    console.error();
    warnings.forEach((msg, i) => console.warn(`  Warning ${i + 1}: ${msg}`));
  } else if (!verbose && warnings.length > 0) {
    console.warn("  (Rerun with --verbose to see warnings.)");
  }
};

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
